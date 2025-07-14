use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::downloads::mod_resolver::TargetMod;
use crate::state::profile_state::{self, ModSource, Profile};
use crate::utils::download_utils::{DownloadConfig, DownloadUtils};
use futures::stream::{iter, StreamExt};
use log::{debug, error, info, warn};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tokio::fs::{self, read_dir};

const DEFAULT_CONCURRENT_MOD_DOWNLOADS: usize = 4;
const MOD_CACHE_DIR_NAME: &str = "mod_cache";

pub struct ModDownloadService {
    concurrent_downloads: usize,
}

impl ModDownloadService {
    pub fn new() -> Self {
        Self {
            concurrent_downloads: DEFAULT_CONCURRENT_MOD_DOWNLOADS,
        }
    }

    pub fn with_concurrency(concurrent_downloads: usize) -> Self {
        Self {
            concurrent_downloads,
        }
    }

    /// Downloads all enabled mods into the central mod cache.
    /// Creates the cache directory if it doesn't exist.
    /// Verifies SHA1 hashes for Modrinth downloads if available.
    pub async fn download_mods_to_cache(&self, profile: &Profile) -> Result<()> {
        info!(
            "Checking/Downloading mods to cache for profile: '{}' (Concurrency: {})",
            profile.name, self.concurrent_downloads
        );

        let mod_cache_dir = LAUNCHER_DIRECTORY.meta_dir().join(MOD_CACHE_DIR_NAME);
        if !mod_cache_dir.exists() {
            info!("Creating mod cache directory: {:?}", mod_cache_dir);
            fs::create_dir_all(&mod_cache_dir).await?;
        }

        let mut download_futures = Vec::new();

        for mod_info in profile.mods.iter() {
            if !mod_info.enabled {
                debug!("Skipping disabled mod: {:?}", mod_info.display_name);
                continue;
            }

            let display_name_opt = mod_info.display_name.clone();
            let cache_dir_clone = mod_cache_dir.clone();
            let source_clone = mod_info.source.clone();

            let filename_result = profile_state::get_profile_mod_filename(&mod_info.source);

            download_futures.push(async move {
                let filename = match filename_result {
                    Ok(fname) => fname,
                    Err(e) => {
                        error!(
                            "Skipping download for mod '{}': {}",
                            display_name_opt.as_deref().unwrap_or("?"),
                            e
                        );
                        return Err(e);
                    }
                };
                let display_name = display_name_opt.as_deref().unwrap_or(&filename);
                let target_path = cache_dir_clone.join(&filename);

                match source_clone {
                    ModSource::Modrinth {
                        download_url,
                        file_hash_sha1,
                        ..
                    } => {
                        info!(
                            "Preparing Modrinth mod for cache: {} ({})",
                            display_name, filename
                        );
                        Self::download_and_verify_file(
                            &download_url,
                            &target_path,
                            file_hash_sha1.as_deref(),
                        )
                        .await
                        .map_err(|e| {
                            error!("Failed cache mod {}: {}", display_name, e);
                            e
                        })
                    }
                    ModSource::Url { url, file_name, .. } => {
                        let fname = file_name.as_deref().unwrap_or("unknown");
                        debug!(
                            "Skipping URL mod source (cache): {} from {}",
                            display_name_opt.as_deref().unwrap_or(fname),
                            url
                        );
                        Ok(())
                    }
                    ModSource::Local { file_name } => {
                        debug!("Skipping local mod (cache check): {}", file_name);
                        Ok(())
                    }
                    ModSource::Maven { .. } => {
                        warn!(
                            "Skipping Maven mod source (cache check - not implemented): {:?}",
                            display_name_opt
                        );
                        Ok(())
                    }
                    ModSource::Embedded { name } => {
                        debug!("Skipping embedded mod (cache check): {}", name);
                        Ok(())
                    }
                    _ => {
                        debug!(
                            "Skipping non-downloadable mod source type after filename check: {}",
                            display_name
                        );
                        Ok(())
                    }
                }
            });
        }

        info!("Executing {} mod cache tasks...", download_futures.len());
        let results: Vec<Result<()>> = iter(download_futures)
            .buffer_unordered(self.concurrent_downloads)
            .collect()
            .await;

        let mut errors = Vec::new();
        for result in results {
            if let Err(e) = result {
                errors.push(e);
            }
        }

        if errors.is_empty() {
            info!(
                "Mod cache check/download process completed successfully for profile: '{}'",
                profile.name
            );
            Ok(())
        } else {
            error!(
                "Mod cache check/download process completed with {} errors for profile: '{}'",
                errors.len(),
                profile.name
            );
            Err(errors.remove(0))
        }
    }

    /// Synchronizes mods from the central cache to the profile's actual game directory mods folder.
    /// Takes the resolved list of target mods to sync.
    pub async fn sync_mods_to_profile(
        &self,
        target_mods: &[TargetMod],
        profile_mods_dir: &PathBuf,
    ) -> Result<()> {
        let profile_name = "Target Profile";
        info!(
            "Syncing resolved mods to profile mods directory '{:?}' for '{}'...",
            profile_mods_dir, profile_name
        );

        if !profile_mods_dir.exists() {
            debug!("Creating profile mods directory: {:?}", profile_mods_dir);
            fs::create_dir_all(&profile_mods_dir).await?;
        }

        let required_mods: HashMap<String, PathBuf> = target_mods
            .iter()
            .map(|tm| (tm.filename.clone(), tm.cache_path.clone()))
            .collect();
        let required_filenames: HashSet<String> = required_mods.keys().cloned().collect();

        debug!("Required mods for sync: {:?}", required_filenames);

        let mut existing_filenames = HashSet::new();
        if profile_mods_dir.exists() {
            let mut dir_entries = read_dir(&profile_mods_dir).await?;
            while let Some(entry) = dir_entries.next_entry().await? {
                let path = entry.path();
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        existing_filenames.insert(filename.to_string());
                    }
                }
            }
        }
        debug!(
            "Existing mods in profile directory: {:?}",
            existing_filenames
        );

        let mods_to_remove: HashSet<String> = existing_filenames
            .difference(&required_filenames)
            .cloned()
            .collect();
        let mods_to_add: HashSet<String> = required_filenames
            .difference(&existing_filenames)
            .cloned()
            .collect();

        for filename in &mods_to_remove {
            let target_path = profile_mods_dir.join(filename);
            info!("Removing mod from '{}': {}", profile_name, filename);
            fs::remove_file(&target_path).await.map_err(|e| {
                error!("Failed to remove {:?}: {}", target_path, e);
                AppError::Io(e)
            })?;
        }

        for filename in &mods_to_add {
            if let Some(cache_path) = required_mods.get(filename) {
                let target_path = profile_mods_dir.join(filename);
                info!("Copying mod to '{}': {}", profile_name, filename);
                fs::copy(cache_path, &target_path).await.map_err(|e| {
                    error!(
                        "Failed to copy {:?} to {:?}: {}",
                        cache_path, target_path, e
                    );
                    AppError::Io(e)
                })?;
            } else {
                error!(
                    "Cache path not found for required mod '{}'! This indicates an internal error.",
                    filename
                );
                return Err(AppError::Other(format!(
                    "Cache path not found for required mod '{}'",
                    filename
                )));
            }
        }

        info!(
            "Mod sync completed for '{}' -> {:?}",
            profile_name, profile_mods_dir
        );
        Ok(())
    }

    /// Downloads a file from a URL to a target path, optionally verifying its SHA1 hash.
    async fn download_and_verify_file(
        url: &str,
        target_path: &PathBuf,
        expected_sha1: Option<&str>,
    ) -> Result<()> {
        // Use the new centralized download utility with SHA1 verification
        let mut config = DownloadConfig::new()
            .with_streaming(true)  // Mods can be large files
            .with_retries(3);      // Built-in retry logic for network issues

        // Add SHA1 verification if provided
        if let Some(sha1) = expected_sha1 {
            config = config.with_sha1(sha1);
        }

        DownloadUtils::download_file(url, target_path, config).await
    }


}
