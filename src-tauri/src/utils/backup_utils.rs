use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::error::{AppError, Result};
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

/// Backup configuration for automatic backups
#[derive(Debug, Clone)]
pub struct BackupConfig {
    /// Maximum number of backups to keep per file
    pub max_backups_per_file: usize,
    /// Maximum age in seconds for backups before they're considered for cleanup
    pub max_backup_age_seconds: u64,
    /// Minimum time between backups in seconds (to prevent spam)
    pub min_backup_interval_seconds: u64,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            max_backups_per_file: 10,
            max_backup_age_seconds: 30 * 24 * 60 * 60, // 30 days
            min_backup_interval_seconds: 60, // 1 minute
        }
    }
}

/// Returns the backup root directory path: <meta_dir>/backups
pub fn get_backup_root() -> PathBuf {
    LAUNCHER_DIRECTORY.meta_dir().join("backups")
}

/// Ensure backup root (and optional category) exists
async fn ensure_backup_dir(category: Option<&str>) -> Result<PathBuf> {
    let mut base = get_backup_root();
    if let Some(cat) = category {
        base = base.join(cat);
    }
    fs::create_dir_all(&base).await.map_err(AppError::Io)?;
    Ok(base)
}

/// Creates an atomic backup of a file before it's modified
/// Returns the path to the backup file
pub async fn create_backup<P: AsRef<Path>>(
    source_path: P,
    category: Option<&str>,
    config: &BackupConfig,
) -> Result<PathBuf> {
    let source_path = source_path.as_ref();

    if !source_path.exists() {
        return Err(AppError::Other(format!(
            "Source file does not exist: {}",
            source_path.display()
        )));
    }

    let backup_base = ensure_backup_dir(category).await?;

    // Generate backup filename with timestamp and UUID
    let timestamp: DateTime<Utc> = Utc::now();
    let ts_str = timestamp.format("%Y%m%d_%H%M%S").to_string();

    // Get original filename
    let original_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("unknown");

    // Create backup filename: original_name.timestamp.uuid.backup
    let backup_filename = format!(
        "{}.{}.{}.backup",
        original_name,
        ts_str,
        Uuid::new_v4().simple()
    );

    let backup_path = backup_base.join(backup_filename);

    // Check if we should skip backup due to minimum interval
    if let Some(last_backup) = get_last_backup_time(source_path, category).await {
        let elapsed = timestamp.signed_duration_since(last_backup).num_seconds();
        if elapsed < config.min_backup_interval_seconds as i64 {
            warn!(
                "Skipping backup for {} - last backup was {} seconds ago (min interval: {})",
                source_path.display(),
                elapsed,
                config.min_backup_interval_seconds
            );
            return Ok(backup_path); // Return the path but don't create backup
        }
    }

    // Copy the file atomically
    fs::copy(&source_path, &backup_path).await.map_err(AppError::Io)?;

    info!(
        "Created backup of '{}' at '{}'",
        source_path.display(),
        backup_path.display()
    );

    // Write metadata file with backup info
    let metadata_path = backup_path.with_extension("backup.meta");
    let metadata = format!(
        "original_path={}\nbackup_time={}\nfile_size={}\n",
        source_path.display(),
        timestamp.to_rfc3339(),
        fs::metadata(&source_path).await?.len()
    );

    fs::write(&metadata_path, metadata.as_bytes()).await.map_err(AppError::Io)?;

    // Cleanup old backups
    cleanup_old_backups(source_path, category, config).await?;

    Ok(backup_path)
}

/// Gets the timestamp of the last backup for a file
async fn get_last_backup_time(source_path: &Path, category: Option<&str>) -> Option<DateTime<Utc>> {
    let backup_base = ensure_backup_dir(category).await.ok()?;

    let original_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("unknown");

    let mut latest_time: Option<DateTime<Utc>> = None;

    if let Ok(mut entries) = fs::read_dir(&backup_base).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(OsStr::to_str) {
                if filename.starts_with(original_name) && filename.ends_with(".backup") {
                    // Try to parse timestamp from filename
                    if let Some(ts_part) = filename.split('.').nth(1) {
                        if let Ok(parsed) = DateTime::parse_from_str(
                            &format!("{} 00:00:00 +00:00", &ts_part[..8]),
                            "%Y%m%d %H:%M:%S %z"
                        ).or_else(|_| {
                            // Try alternative format
                            DateTime::parse_from_str(ts_part, "%Y%m%d_%H%M%S")
                        }) {
                            let utc_time = parsed.with_timezone(&Utc);
                            if latest_time.is_none() || utc_time > latest_time.unwrap() {
                                latest_time = Some(utc_time);
                            }
                        }
                    }
                }
            }
        }
    }

    latest_time
}

/// Cleans up old backups according to the configuration
pub async fn cleanup_old_backups(
    source_path: &Path,
    category: Option<&str>,
    config: &BackupConfig,
) -> Result<()> {
    let backup_base = ensure_backup_dir(category).await?;
    let now = Utc::now();

    let original_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("unknown");

    // Collect all backup files for this source with their metadata
    let mut backup_files = Vec::new();

    if let Ok(mut entries) = fs::read_dir(&backup_base).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(OsStr::to_str) {
                if filename.starts_with(original_name) && filename.ends_with(".backup") {
                    if let Ok(metadata) = fs::metadata(&path).await {
                        if let Ok(modified) = metadata.modified() {
                            backup_files.push((path, modified));
                        }
                    }
                }
            }
        }
    }

    // Sort by modification time (newest first)
    backup_files.sort_by_key(|(_, time)| std::cmp::Reverse(*time));

    // Remove old backups beyond the limit
    if backup_files.len() > config.max_backups_per_file {
        let to_remove = &backup_files[config.max_backups_per_file..];
        for (backup_path, _) in to_remove {
            if let Err(e) = fs::remove_file(backup_path).await {
                warn!("Failed to remove old backup '{}': {}", backup_path.display(), e);
            } else {
                // Also remove metadata file
                let meta_path = backup_path.with_extension("backup.meta");
                let _ = fs::remove_file(&meta_path).await;
                info!("Removed old backup: {}", backup_path.display());
            }
        }
    }

    // Remove backups older than max age
    for (backup_path, modified_time) in &backup_files {
        let modified_dt: DateTime<Utc> = (*modified_time).into();
        let age_seconds = now.signed_duration_since(modified_dt).num_seconds();

        if age_seconds > config.max_backup_age_seconds as i64 {
            if let Err(e) = fs::remove_file(backup_path).await {
                warn!("Failed to remove expired backup '{}': {}", backup_path.display(), e);
            } else {
                // Also remove metadata file
                let meta_path = backup_path.with_extension("backup.meta");
                let _ = fs::remove_file(&meta_path).await;
                info!("Removed expired backup: {}", backup_path.display());
            }
        }
    }

    Ok(())
}

/// Restores a file from the most recent backup
pub async fn restore_from_backup<P: AsRef<Path>>(
    target_path: P,
    category: Option<&str>,
) -> Result<PathBuf> {
    let target_path = target_path.as_ref();
    let backup_base = ensure_backup_dir(category).await?;

    let original_name = target_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("unknown");

    // Find the most recent backup
    let mut latest_backup: Option<PathBuf> = None;
    let mut latest_time = DateTime::<Utc>::from_utc(
        chrono::naive::NaiveDateTime::from_timestamp(0, 0),
        Utc
    );

    if let Ok(mut entries) = fs::read_dir(&backup_base).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(OsStr::to_str) {
                if filename.starts_with(original_name) && filename.ends_with(".backup") {
                    if let Ok(metadata) = fs::metadata(&path).await {
                        if let Ok(modified) = metadata.modified() {
                            let modified_dt: DateTime<Utc> = modified.into();
                            if modified_dt > latest_time {
                                latest_time = modified_dt;
                                latest_backup = Some(path);
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(backup_path) = latest_backup {
        // Create a timestamped copy of the current file (if it exists) before restoring
        if target_path.exists() {
            let corrupted_path = target_path.with_extension(format!(
                "corrupted.{}",
                Utc::now().format("%Y%m%d_%H%M%S")
            ));
            fs::copy(&target_path, &corrupted_path).await?;
            info!("Saved potentially corrupted file as: {}", corrupted_path.display());
        }

        // Restore from backup
        fs::copy(&backup_path, &target_path).await.map_err(AppError::Io)?;

        info!(
            "Restored '{}' from backup '{}'",
            target_path.display(),
            backup_path.display()
        );

        Ok(target_path.to_path_buf())
    } else {
        Err(AppError::Other(format!(
            "No backup found for '{}'",
            target_path.display()
        )))
    }
}

/// Lists all available backups for a file
pub async fn list_backups<P: AsRef<Path>>(
    source_path: P,
    category: Option<&str>,
) -> Result<Vec<(PathBuf, DateTime<Utc>)>> {
    let source_path = source_path.as_ref();
    let backup_base = ensure_backup_dir(category).await?;

    let original_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("unknown");

    let mut backups = Vec::new();

    if let Ok(mut entries) = fs::read_dir(&backup_base).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(OsStr::to_str) {
                if filename.starts_with(original_name) && filename.ends_with(".backup") {
                    if let Ok(metadata) = fs::metadata(&path).await {
                        if let Ok(modified) = metadata.modified() {
                            let modified_dt: DateTime<Utc> = modified.into();
                            backups.push((path, modified_dt));
                        }
                    }
                }
            }
        }
    }

    // Sort by time (newest first)
    backups.sort_by(|a, b| b.1.cmp(&a.1));

    Ok(backups)
}

/// Gets backup statistics
pub async fn get_backup_stats(category: Option<&str>) -> Result<BackupStats> {
    let backup_base = ensure_backup_dir(category).await?;

    let mut total_backups = 0;
    let mut total_size = 0u64;
    let mut oldest_backup: Option<DateTime<Utc>> = None;
    let mut newest_backup: Option<DateTime<Utc>> = None;

    if let Ok(mut entries) = fs::read_dir(&backup_base).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(OsStr::to_str) {
                if filename.ends_with(".backup") {
                    total_backups += 1;

                    if let Ok(metadata) = fs::metadata(&path).await {
                        total_size += metadata.len();

                        if let Ok(modified) = metadata.modified() {
                            let modified_dt: DateTime<Utc> = modified.into();

                            oldest_backup = Some(match oldest_backup {
                                Some(oldest) => oldest.min(modified_dt),
                                None => modified_dt,
                            });

                            newest_backup = Some(match newest_backup {
                                Some(newest) => newest.max(modified_dt),
                                None => modified_dt,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(BackupStats {
        total_backups,
        total_size,
        oldest_backup,
        newest_backup,
    })
}

/// Statistics about backups
#[derive(Debug)]
pub struct BackupStats {
    pub total_backups: usize,
    pub total_size: u64,
    pub oldest_backup: Option<DateTime<Utc>>,
    pub newest_backup: Option<DateTime<Utc>>,
}

/// Safe write operation with automatic backup
pub async fn safe_write_with_backup<P: AsRef<Path>, C: AsRef<[u8]>>(
    file_path: P,
    contents: C,
    category: Option<&str>,
    config: &BackupConfig,
) -> Result<()> {
    let file_path = file_path.as_ref();

    // Create backup if file exists
    if file_path.exists() {
        create_backup(file_path, category, config).await?;
    }

    // Write new content (atomic operation)
    let temp_path = file_path.with_extension("tmp");
    fs::write(&temp_path, contents).await.map_err(AppError::Io)?;

    // Atomic move
    fs::rename(&temp_path, file_path).await.map_err(AppError::Io)?;

    info!("Successfully wrote file with backup: {}", file_path.display());
    Ok(())
}

/// Validates a backup file
pub async fn validate_backup(backup_path: &Path) -> Result<bool> {
    if !backup_path.exists() {
        return Ok(false);
    }

    // Check if metadata file exists
    let meta_path = backup_path.with_extension("backup.meta");
    if !meta_path.exists() {
        warn!("Backup metadata missing for: {}", backup_path.display());
        return Ok(false);
    }

    // Try to read metadata
    match fs::read_to_string(&meta_path).await {
        Ok(metadata) => {
            // Basic validation - check if required fields are present
            let has_original_path = metadata.contains("original_path=");
            let has_backup_time = metadata.contains("backup_time=");
            let has_file_size = metadata.contains("file_size=");

            if !has_original_path || !has_backup_time || !has_file_size {
                warn!("Backup metadata incomplete for: {}", backup_path.display());
                return Ok(false);
            }

            Ok(true)
        }
        Err(e) => {
            error!("Failed to read backup metadata '{}': {}", meta_path.display(), e);
            Ok(false)
        }
    }
}

