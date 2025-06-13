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

/// Represents a shaderpack found in the profile directory
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShaderPackInfo {
    /// Filename of the shaderpack (e.g. "awesome_shader.zip")
    pub filename: String,
    /// Full path to the shaderpack file
    pub path: String,
    /// SHA1 hash of the file
    pub sha1_hash: Option<String>,
    /// File size in bytes
    pub file_size: u64,
    /// True if the shaderpack is disabled (.disabled extension)
    pub is_disabled: bool,
    /// Optional Modrinth information if the pack was found on Modrinth
    pub modrinth_info: Option<ShaderPackModrinthInfo>,
}

/// Modrinth information for a shaderpack
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShaderPackModrinthInfo {
    /// Modrinth project ID
    pub project_id: String,
    /// Modrinth version ID
    pub version_id: String,
    /// Name of the shaderpack on Modrinth
    pub name: String,
    /// Version string
    pub version_number: String,
    /// Download URL
    pub download_url: String,
}

/// Get all shaderpacks for a profile
pub async fn get_shaderpacks_for_profile(profile: &Profile) -> Result<Vec<ShaderPackInfo>> {
    debug!(
        "Getting shaderpacks for profile: {} ({})",
        profile.name, profile.id
    );

    // Construct the path to the shaderpacks directory
    let shaderpacks_dir = get_shaderpacks_dir(profile).await?;
    debug!("Shaderpacks directory path: {}", shaderpacks_dir.display());

    // Return empty list if directory doesn't exist yet
    if !shaderpacks_dir.exists() {
        debug!(
            "Shaderpacks directory does not exist for profile: {}",
            profile.id
        );
        return Ok(Vec::new());
    }

    // Read directory contents
    debug!("Reading contents of shaderpacks directory...");
    let mut entries = fs::read_dir(&shaderpacks_dir)
        .await
        .map_err(|e| AppError::Other(format!("Failed to read shaderpacks directory: {}", e)))?;

    let mut shaderpacks = Vec::new();
    let mut hashes = Vec::new();
    let mut path_to_info = HashMap::new();

    // Collect all valid shader files (.zip, .zip.disabled, directories)
    debug!("Scanning shaderpacks directory for valid shader packs...");
    let mut file_count = 0;
    let mut valid_count = 0;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Other(format!("Failed to read shaderpack entry: {}", e)))?
    {
        file_count += 1;
        let path = entry.path();
        debug!("Checking file: {}", path.display());

        if is_shaderpack_file(&path).await? {
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
                "Found valid shaderpack: {} (disabled: {})",
                base_filename, is_disabled
            );

            let metadata = fs::metadata(&path).await.map_err(|e| {
                AppError::Other(format!("Failed to get metadata for {}: {}", filename, e))
            })?;

            let file_size = metadata.len();
            debug!("Shaderpack size: {} bytes", file_size);

            // Only hash files, not directories (shaders can be directories)
            let sha1_hash = if path.is_file() {
                debug!("Calculating SHA1 hash for {}", filename);
                match hash_utils::calculate_sha1(&path).await {
                    Ok(hash) => {
                        debug!("SHA1 hash for {}: {}", filename, hash);
                        // Add to the list of hashes to check against Modrinth
                        hashes.push(hash.clone());
                        Some(hash)
                    }
                    Err(e) => {
                        warn!(
                            "Failed to compute SHA1 hash for shaderpack {}: {}",
                            filename, e
                        );
                        None
                    }
                }
            } else {
                debug!("Skipping hash calculation for directory: {}", filename);
                None
            };

            let info = ShaderPackInfo {
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
                shaderpacks.push(info);
            }
        } else {
            debug!("Skipping non-shaderpack file/directory: {}", path.display());
        }
    }

    debug!(
        "Scanned {} files/directories, found {} valid shaderpacks",
        file_count, valid_count
    );

    // If we have hashes, try to look them up on Modrinth
    if !hashes.is_empty() {
        debug!(
            "Looking up {} shader packs on Modrinth by hash...",
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

                        // Check if this is actually a shader and not something else
                        if version.project_id.is_empty() || version.id.is_empty() {
                            debug!("Skipping invalid Modrinth data for hash {}: empty project_id or version_id", hash);
                            continue;
                        }

                        // Find the primary file for the URL
                        if let Some(primary_file) = version.files.iter().find(|f| f.primary) {
                            debug!(
                                "Using primary file from Modrinth: {}",
                                primary_file.filename
                            );
                            info.modrinth_info = Some(ShaderPackModrinthInfo {
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
                warn!("Failed to lookup shaderpacks on Modrinth: {}", e);
            }
        }
    } else {
        debug!("No shader packs to lookup on Modrinth");
    }

    // Add all packs to the result list
    for (hash, info) in path_to_info {
        debug!(
            "Adding pack with hash {} to result list: {}",
            hash, info.filename
        );
        shaderpacks.push(info);
    }

    info!(
        "Found {} total shaderpacks for profile {}",
        shaderpacks.len(),
        profile.id
    );

    Ok(shaderpacks)
}

/// Get the path to the shaderpacks directory for a profile
pub async fn get_shaderpacks_dir(profile: &Profile) -> Result<PathBuf> {
    let state = State::get().await?;
    let base_profiles_dir = state
        .profile_manager
        .calculate_instance_path_for_profile(profile)?;
    let shaderpacks_dir = base_profiles_dir.join("shaderpacks");
    debug!(
        "Shaderpacks directory for profile {}: {}",
        profile.id,
        shaderpacks_dir.display()
    );
    Ok(shaderpacks_dir)
}

/// Check if a path is a shaderpack file/directory
async fn is_shaderpack_file(path: &Path) -> Result<bool> {
    let metadata = fs::metadata(path)
        .await
        .map_err(|e| AppError::Other(format!("Failed to get metadata: {}", e)))?;

    // Shader packs can be directories or zip files
    if metadata.is_dir() {
        debug!("Checking if directory is a shader pack: {}", path.display());
        // Check if it contains files that make it a shader pack
        // (typically shaders/composite.fsh or similar)
        let result = is_shader_directory(path).await?;
        if result {
            debug!("Directory confirmed as shader pack: {}", path.display());
        } else {
            debug!("Directory is not a shader pack: {}", path.display());
        }
        return Ok(result);
    }

    if metadata.is_file() {
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(name) => name,
            None => return Ok(false),
        };

        // Check for .zip or .zip.disabled extension for shader zip files
        let is_zip = file_name.ends_with(".zip") || file_name.ends_with(".zip.disabled");
        if is_zip {
            debug!("File confirmed as shader pack (zip): {}", path.display());
        } else {
            debug!("File is not a shader pack (not a zip): {}", path.display());
        }
        return Ok(is_zip);
    }

    debug!("Path is neither file nor directory: {}", path.display());
    Ok(false)
}

/// Check if a directory contains shader files
async fn is_shader_directory(path: &Path) -> Result<bool> {
    // Look for common shader files in the right places
    let shader_dir = path.join("shaders");
    debug!("Checking for shader directory at: {}", shader_dir.display());

    if !shader_dir.exists() {
        debug!("No 'shaders' subdirectory found in: {}", path.display());
        return Ok(false);
    }

    // Check for common shader files
    for common_file in &["composite.fsh", "final.fsh", "gbuffers_basic.fsh"] {
        let common_file_path = shader_dir.join(common_file);
        if common_file_path.exists() {
            debug!("Found common shader file: {}", common_file_path.display());
            return Ok(true);
        }
    }

    debug!("No common shader files found, checking for any .fsh or .vsh files...");

    // If we can't find specific files, check if there are any .fsh or .vsh files
    let mut entries = fs::read_dir(&shader_dir)
        .await
        .map_err(|e| AppError::Other(format!("Failed to read shader directory: {}", e)))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Other(format!("Failed to read shader entry: {}", e)))?
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(extension) = path.extension().and_then(|e| e.to_str()) {
                if extension == "fsh" || extension == "vsh" {
                    debug!(
                        "Found shader file with .fsh or .vsh extension: {}",
                        path.display()
                    );
                    return Ok(true);
                }
            }
        }
    }

    debug!(
        "No shader files found in directory: {}",
        shader_dir.display()
    );
    Ok(false)
}

/// Update a shader pack from Modrinth to a new version
pub async fn update_shaderpack_from_modrinth(
    profile: &Profile,
    shaderpack: &ShaderPackInfo,
    new_version: &crate::integrations::modrinth::ModrinthVersion,
) -> Result<()> {
    info!(
        "Updating shader pack '{}' to version {} in profile {}",
        shaderpack.filename, new_version.version_number, profile.id
    );

    // Get the shaderpacks directory
    let shaderpacks_dir = get_shaderpacks_dir(profile).await?;

    // Check if the directory exists, create if not
    if !shaderpacks_dir.exists() {
        debug!("Creating shaderpacks directory for profile: {}", profile.id);
        fs::create_dir_all(&shaderpacks_dir).await.map_err(|e| {
            AppError::Other(format!("Failed to create shaderpacks directory: {}", e))
        })?;
    }

    // Find and delete the old file/directory (including .disabled variant)
    let old_path = shaderpacks_dir.join(&shaderpack.filename);
    let old_path_disabled = shaderpacks_dir.join(format!("{}.disabled", shaderpack.filename));

    let was_disabled = shaderpack.is_disabled;

    // Find the primary file in the new version
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

    // Check and delete the old file/directory
    if old_path.exists() {
        debug!("Removing old shader pack: {}", old_path.display());
        if old_path.is_dir() {
            fs::remove_dir_all(&old_path).await.map_err(|e| {
                AppError::Other(format!("Failed to remove old shader pack directory: {}", e))
            })?;
        } else {
            fs::remove_file(&old_path).await.map_err(|e| {
                AppError::Other(format!("Failed to remove old shader pack file: {}", e))
            })?;
        }
    } else if old_path_disabled.exists() {
        debug!(
            "Removing old disabled shader pack: {}",
            old_path_disabled.display()
        );
        if old_path_disabled.is_dir() {
            fs::remove_dir_all(&old_path_disabled).await.map_err(|e| {
                AppError::Other(format!(
                    "Failed to remove old disabled shader pack directory: {}",
                    e
                ))
            })?;
        } else {
            fs::remove_file(&old_path_disabled).await.map_err(|e| {
                AppError::Other(format!(
                    "Failed to remove old disabled shader pack file: {}",
                    e
                ))
            })?;
        }
    } else {
        warn!("Old shader pack not found: {}", shaderpack.filename);
    }

    // Use the utility function to download the new content
    use crate::utils::profile_utils::{add_modrinth_content_to_profile, ContentType};

    // Download the new shader pack
    add_modrinth_content_to_profile(
        profile.id,
        new_version.project_id.clone(),
        new_version.id.clone(),
        primary_file.filename.clone(),
        primary_file.url.clone(),
        primary_file.hashes.sha1.clone(),
        Some(new_version.name.clone()),
        Some(new_version.version_number.clone()),
        ContentType::ShaderPack,
    )
    .await?;

    // If the old pack was disabled, disable the new one too
    if was_disabled {
        let new_path = shaderpacks_dir.join(&primary_file.filename);
        let new_path_disabled = shaderpacks_dir.join(format!("{}.disabled", primary_file.filename));

        debug!("Old pack was disabled, disabling new pack as well");

        // Handle both file and directory cases
        if new_path.is_dir() {
            // For directories, we need to rename them
            debug!(
                "Renaming directory to disabled: {} -> {}",
                new_path.display(),
                new_path_disabled.display()
            );
            fs::rename(&new_path, &new_path_disabled)
                .await
                .map_err(|e| {
                    AppError::Other(format!(
                        "Failed to disable new shader pack directory: {}",
                        e
                    ))
                })?;
        } else {
            debug!(
                "Renaming file to disabled: {} -> {}",
                new_path.display(),
                new_path_disabled.display()
            );
            fs::rename(&new_path, &new_path_disabled)
                .await
                .map_err(|e| {
                    AppError::Other(format!("Failed to disable new shader pack file: {}", e))
                })?;
        }
    }

    info!(
        "Successfully updated shader pack from '{}' to '{}'",
        shaderpack.filename, primary_file.filename
    );

    Ok(())
}
