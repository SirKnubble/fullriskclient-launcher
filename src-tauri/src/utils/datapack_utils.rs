use crate::error::{AppError, Result};
use crate::integrations::modrinth;
use crate::state::profile_state::Profile;
use crate::state::state_manager::State;
use crate::utils::hash_utils;
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;

/// Represents a datapack found in the profile directory
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataPackInfo {
    /// Filename of the datapack (e.g. "awesome_datapack.zip")
    pub filename: String,
    /// Full path to the datapack file
    pub path: String,
    /// SHA1 hash of the file
    pub sha1_hash: Option<String>,
    /// File size in bytes
    pub file_size: u64,
    /// True if the datapack is disabled (.disabled extension)
    pub is_disabled: bool,
    /// Optional Modrinth information if the pack was found on Modrinth
    pub modrinth_info: Option<DataPackModrinthInfo>,
}

/// Modrinth information for a datapack
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataPackModrinthInfo {
    /// Modrinth project ID
    pub project_id: String,
    /// Modrinth version ID
    pub version_id: String,
    /// Name of the datapack on Modrinth
    pub name: String,
    /// Version string
    pub version_number: String,
    /// Download URL
    pub download_url: String,
}

/// Get all datapacks for a profile
pub async fn get_datapacks_for_profile(profile: &Profile) -> Result<Vec<DataPackInfo>> {
    debug!(
        "Getting datapacks for profile: {} ({})",
        profile.name, profile.id
    );

    // Construct the path to the datapacks directory
    let datapacks_dir = get_datapacks_dir(profile).await?;
    debug!("Datapacks directory path: {}", datapacks_dir.display());

    // Return empty list if directory doesn't exist yet
    if !datapacks_dir.exists() {
        debug!(
            "Datapacks directory does not exist for profile: {}",
            profile.id
        );
        return Ok(Vec::new());
    }

    // Read directory contents
    debug!("Reading contents of datapacks directory...");
    let mut entries = fs::read_dir(&datapacks_dir)
        .await
        .map_err(|e| AppError::Other(format!("Failed to read datapacks directory: {}", e)))?;

    let mut datapacks = Vec::new();
    let mut hashes = Vec::new();
    let mut path_to_info = HashMap::new();

    // Collect all .zip and .zip.disabled files
    debug!("Scanning datapacks directory for valid data packs...");
    let mut file_count = 0;
    let mut valid_count = 0;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Other(format!("Failed to read datapack entry: {}", e)))?
    {
        file_count += 1;
        let path = entry.path();
        debug!("Checking file: {}", path.display());

        if is_datapack_file(&path) {
            valid_count += 1;
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let is_disabled = filename.ends_with(".disabled");
            let base_filename = if is_disabled {
                filename
                    .strip_suffix(".disabled")
                    .unwrap_or(&filename)
                    .to_string()
            } else {
                filename.clone()
            };

            debug!(
                "Found valid datapack: {} (disabled: {})",
                base_filename, is_disabled
            );

            let metadata = fs::metadata(&path).await.map_err(|e| {
                AppError::Other(format!("Failed to get metadata for {}: {}", filename, e))
            })?;

            let file_size = metadata.len();
            debug!("Datapack size: {} bytes", file_size);

            // Hash the file
            debug!("Calculating SHA1 hash for {}", filename);
            let sha1_hash = match hash_utils::calculate_sha1(&path).await {
                Ok(hash) => {
                    debug!("SHA1 hash for {}: {}", filename, hash);
                    // Add to the list of hashes to check against Modrinth
                    hashes.push(hash.clone());
                    Some(hash)
                }
                Err(e) => {
                    warn!(
                        "Failed to compute SHA1 hash for datapack {}: {}",
                        filename, e
                    );
                    None
                }
            };

            let info = DataPackInfo {
                filename: base_filename,
                path: path.to_string_lossy().into_owned(),
                sha1_hash: sha1_hash.clone(),
                file_size,
                is_disabled,
                modrinth_info: None,
            };

            // Store info in hashmap to update with Modrinth data later
            if let Some(hash) = sha1_hash {
                path_to_info.insert(hash, info);
            } else {
                datapacks.push(info);
            }
        } else {
            debug!("Skipping non-datapack file: {}", path.display());
        }
    }

    debug!(
        "Scanned {} files/directories, found {} valid datapacks",
        file_count, valid_count
    );

    // If we have hashes, try to look them up on Modrinth
    if !hashes.is_empty() {
        debug!(
            "Looking up {} data packs on Modrinth by hash...",
            hashes.len()
        );
        match modrinth::get_versions_by_hashes(hashes.clone(), "sha1").await {
            Ok(version_map) => {
                debug!(
                    "Modrinth lookup returned {} matches out of {} requested",
                    version_map.len(),
                    hashes.len()
                );
                for (hash, version) in version_map {
                    if let Some(info) = path_to_info.get_mut(&hash) {
                        debug!(
                            "Found Modrinth info for pack with hash {}: project_id={}, name={}",
                            hash, version.project_id, version.name
                        );

                        // Check if this is actually a datapack and not something else
                        if version.project_id.is_empty() || version.id.is_empty() {
                            debug!("Skipping invalid Modrinth data for hash {}: empty project_id or version_id", hash);
                            continue;
                        }

                        // Find the primary file in the new version
                        log::debug!(
                            "Files in new_version for datapack update: {:?}",
                            version.files
                        );
                        let primary_file =
                            version.files.iter().find(|f| f.primary).ok_or_else(|| {
                                AppError::Other(format!(
                                    "No primary file found for Modrinth version {} (ID: {})",
                                    version.name, version.id
                                ))
                            })?;

                        // Find the primary file for the URL
                        if let Some(primary_file) = version.files.iter().find(|f| f.primary) {
                            debug!(
                                "Using primary file from Modrinth: {}",
                                primary_file.filename
                            );
                            info.modrinth_info = Some(DataPackModrinthInfo {
                                project_id: version.project_id.clone(),
                                version_id: version.id.clone(),
                                name: version.name.clone(),
                                version_number: version.version_number.clone(),
                                download_url: primary_file.url.clone(),
                            });
                        } else {
                            debug!(
                                "No primary file found in Modrinth version for hash {}",
                                hash
                            );
                        }
                    } else {
                        debug!("Received Modrinth data for unknown hash: {}", hash);
                    }
                }
            }
            Err(e) => {
                warn!("Failed to lookup datapacks on Modrinth: {}", e);
            }
        }
    } else {
        debug!("No data packs to lookup on Modrinth");
    }

    // Add all packs to the result list
    for (hash, info) in path_to_info {
        debug!(
            "Adding pack with hash {} to result list: {}",
            hash, info.filename
        );
        datapacks.push(info);
    }

    info!(
        "Found {} total datapacks for profile {}",
        datapacks.len(),
        profile.id
    );

    Ok(datapacks)
}

/// Get the path to the datapacks directory for a profile
pub async fn get_datapacks_dir(profile: &Profile) -> Result<PathBuf> {
    let state = State::get().await?;
    let base_profiles_dir = state
        .profile_manager
        .calculate_instance_path_for_profile(profile)?;
    let datapacks_dir = base_profiles_dir.join("datapacks");
    debug!(
        "Datapacks directory for profile {}: {}",
        profile.id,
        datapacks_dir.display()
    );
    Ok(datapacks_dir)
}

/// Check if a path is a datapack file
fn is_datapack_file(path: &Path) -> bool {
    if !path.is_file() {
        debug!("Skipping non-file path: {}", path.display());
        return false;
    }

    let file_name = match path.file_name().and_then(|s| s.to_str()) {
        Some(name) => name,
        None => {
            debug!("Path has no valid filename: {}", path.display());
            return false;
        }
    };

    // Check for .zip or .zip.disabled extension
    let is_zip = file_name.ends_with(".zip") || file_name.ends_with(".zip.disabled");
    if is_zip {
        debug!("File confirmed as data pack (zip): {}", path.display());
    } else {
        debug!("File is not a data pack (not a zip): {}", path.display());
    }
    return is_zip;
}

/// Update a data pack from Modrinth to a new version
pub async fn update_datapack_from_modrinth(
    profile: &Profile,
    datapack: &DataPackInfo,
    new_version: &crate::integrations::modrinth::ModrinthVersion,
) -> Result<()> {
    info!(
        "Updating data pack '{}' to version {} in profile {}",
        datapack.filename, new_version.version_number, profile.id
    );

    // Get the datapacks directory
    let datapacks_dir = get_datapacks_dir(profile).await?;

    // Check if the directory exists, create if not
    if !datapacks_dir.exists() {
        debug!("Creating datapacks directory for profile: {}", profile.id);
        fs::create_dir_all(&datapacks_dir)
            .await
            .map_err(|e| AppError::Other(format!("Failed to create datapacks directory: {}", e)))?;
    }

    // Find and delete the old file (including .disabled variant)
    let old_path = datapacks_dir.join(&datapack.filename);
    let old_path_disabled = datapacks_dir.join(format!("{}.disabled", datapack.filename));

    let was_disabled = datapack.is_disabled;

    // Find the primary file in the new version
    log::debug!(
        "Files in new_version for datapack update: {:?}",
        new_version.files
    );
    let primary_file = new_version
        .files
        .iter()
        .find(|f| f.primary)
        .ok_or_else(|| {
            AppError::Other(format!(
                "No primary file found for Modrinth version {} (ID: {})",
                new_version.name, new_version.id
            ))
        })?;

    // Check and delete the old file
    if old_path.exists() {
        debug!("Removing old data pack file: {}", old_path.display());
        fs::remove_file(&old_path)
            .await
            .map_err(|e| AppError::Other(format!("Failed to remove old data pack file: {}", e)))?;
    } else if old_path_disabled.exists() {
        debug!(
            "Removing old disabled data pack file: {}",
            old_path_disabled.display()
        );
        fs::remove_file(&old_path_disabled).await.map_err(|e| {
            AppError::Other(format!(
                "Failed to remove old disabled data pack file: {}",
                e
            ))
        })?;
    } else {
        warn!("Old data pack file not found: {}", datapack.filename);
    }

    // Use the utility function to download the new content
    use crate::utils::profile_utils::{add_modrinth_content_to_profile, ContentType};

    // Download the new data pack
    add_modrinth_content_to_profile(
        profile.id,
        new_version.project_id.clone(),
        new_version.id.clone(),
        primary_file.filename.clone(),
        primary_file.url.clone(),
        primary_file.hashes.sha1.clone(),
        Some(new_version.name.clone()),
        Some(new_version.version_number.clone()),
        ContentType::DataPack,
    )
    .await?;

    // If the old pack was disabled, disable the new one too
    if was_disabled {
        let new_path = datapacks_dir.join(&primary_file.filename);
        let new_path_disabled = datapacks_dir.join(format!("{}.disabled", primary_file.filename));

        debug!("Old pack was disabled, disabling new pack as well");
        fs::rename(&new_path, &new_path_disabled)
            .await
            .map_err(|e| AppError::Other(format!("Failed to disable new data pack: {}", e)))?;
    }

    info!(
        "Successfully updated data pack from '{}' to '{}'",
        datapack.filename, primary_file.filename
    );

    Ok(())
}
