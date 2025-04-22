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

/// Represents a resourcepack found in the profile directory
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ResourcePackInfo {
    /// Filename of the resourcepack (e.g. "awesome_pack.zip")
    pub filename: String,
    /// Full path to the resourcepack file
    pub path: String,
    /// SHA1 hash of the file
    pub sha1_hash: Option<String>,
    /// File size in bytes
    pub file_size: u64,
    /// True if the resourcepack is disabled (.disabled extension)
    pub is_disabled: bool,
    /// Optional Modrinth information if the pack was found on Modrinth
    pub modrinth_info: Option<ResourcePackModrinthInfo>,
}

/// Modrinth information for a resourcepack
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ResourcePackModrinthInfo {
    /// Modrinth project ID
    pub project_id: String,
    /// Modrinth version ID
    pub version_id: String,
    /// Name of the resourcepack on Modrinth
    pub name: String,
    /// Version string
    pub version_number: String,
    /// Download URL
    pub download_url: String,
}

/// Get all resourcepacks for a profile
pub async fn get_resourcepacks_for_profile(profile: &Profile) -> Result<Vec<ResourcePackInfo>> {
    debug!("Getting resourcepacks for profile: {} ({})", profile.name, profile.id);
    
    // Construct the path to the resourcepacks directory
    let resourcepacks_dir = get_resourcepacks_dir(profile).await?;
    debug!("Resourcepacks directory path: {}", resourcepacks_dir.display());
    
    // Return empty list if directory doesn't exist yet
    if !resourcepacks_dir.exists() {
        debug!("Resourcepacks directory does not exist for profile: {}", profile.id);
        return Ok(Vec::new());
    }

    // Read directory contents
    debug!("Reading contents of resourcepacks directory...");
    let mut entries = fs::read_dir(&resourcepacks_dir).await
        .map_err(|e| AppError::Other(format!("Failed to read resourcepacks directory: {}", e)))?;
    
    let mut resourcepacks = Vec::new();
    let mut hashes = Vec::new();
    let mut path_to_info = HashMap::new();
    
    // Collect all .zip and .zip.disabled files
    debug!("Scanning resourcepacks directory for valid resource packs...");
    let mut file_count = 0;
    let mut valid_count = 0;
    
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| AppError::Other(format!("Failed to read resourcepack entry: {}", e)))? 
    {
        file_count += 1;
        let path = entry.path();
        debug!("Checking file: {}", path.display());
        
        if is_resourcepack_file(&path) {
            valid_count += 1;
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            
            let is_disabled = filename.ends_with(".disabled");
            let base_filename = if is_disabled {
                filename.strip_suffix(".disabled").unwrap_or(&filename).to_string()
            } else {
                filename.clone()
            };
            
            debug!("Found valid resourcepack: {} (disabled: {})", base_filename, is_disabled);
            
            let metadata = fs::metadata(&path).await
                .map_err(|e| AppError::Other(format!("Failed to get metadata for {}: {}", filename, e)))?;
            
            let file_size = metadata.len();
            debug!("Resourcepack size: {} bytes", file_size);

            // Hash the file
            debug!("Calculating SHA1 hash for {}", filename);
            let sha1_hash = match hash_utils::calculate_sha1(&path).await {
                Ok(hash) => {
                    debug!("SHA1 hash for {}: {}", filename, hash);
                    // Add to the list of hashes to check against Modrinth
                    hashes.push(hash.clone());
                    Some(hash)
                },
                Err(e) => {
                    warn!("Failed to compute SHA1 hash for resourcepack {}: {}", filename, e);
                    None
                }
            };
            
            let info = ResourcePackInfo {
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
                resourcepacks.push(info);
            }
        } else {
            debug!("Skipping non-resourcepack file: {}", path.display());
        }
    }
    
    debug!("Scanned {} files/directories, found {} valid resourcepacks", file_count, valid_count);
    
    // If we have hashes, try to look them up on Modrinth
    if !hashes.is_empty() {
        debug!("Looking up {} resource packs on Modrinth by hash...", hashes.len());
        match modrinth::get_versions_by_hashes(hashes.clone(), "sha1").await {
            Ok(version_map) => {
                debug!("Modrinth lookup returned {} matches out of {} requested", version_map.len(), hashes.len());
                for (hash, version) in version_map {
                    if let Some(info) = path_to_info.get_mut(&hash) {
                        debug!("Found Modrinth info for pack with hash {}: project_id={}, name={}", 
                               hash, version.project_id, version.name);
                        
                        // Check if this is actually a resourcepack and not something else
                        if version.project_id.is_empty() || version.id.is_empty() {
                            debug!("Skipping invalid Modrinth data for hash {}: empty project_id or version_id", hash);
                            continue;
                        }
                        
                        // Find the primary file for the URL
                        if let Some(primary_file) = version.files.iter().find(|f| f.primary) {
                            debug!("Using primary file from Modrinth: {}", primary_file.filename);
                            info.modrinth_info = Some(ResourcePackModrinthInfo {
                                project_id: version.project_id.clone(),
                                version_id: version.id.clone(),
                                name: version.name.clone(),
                                version_number: version.version_number.clone(),
                                download_url: primary_file.url.clone(),
                            });
                        } else {
                            debug!("No primary file found in Modrinth version for hash {}", hash);
                        }
                    } else {
                        debug!("Received Modrinth data for unknown hash: {}", hash);
                    }
                }
            },
            Err(e) => {
                warn!("Failed to lookup resourcepacks on Modrinth: {}", e);
            }
        }
    } else {
        debug!("No resource packs to lookup on Modrinth");
    }
    
    // Add all packs to the result list
    for (hash, info) in path_to_info {
        debug!("Adding pack with hash {} to result list: {}", hash, info.filename);
        resourcepacks.push(info);
    }
    
    info!("Found {} total resourcepacks for profile {}", resourcepacks.len(), profile.id);
    
    Ok(resourcepacks)
}

/// Get the path to the resourcepacks directory for a profile
pub async fn get_resourcepacks_dir(profile: &Profile) -> Result<PathBuf> {
    let state = State::get().await?;
    let base_profiles_dir = state.profile_manager.calculate_instance_path_for_profile(profile)?;
    let resourcepacks_dir = base_profiles_dir.join("resourcepacks");
    debug!("Resourcepacks directory for profile {}: {}", profile.id, resourcepacks_dir.display());
    Ok(resourcepacks_dir)
}

/// Check if a path is a resourcepack file
fn is_resourcepack_file(path: &Path) -> bool {
    if !path.is_file() {
        debug!("Skipping non-file path: {}", path.display());
        return false;
    }
    
    let file_name = match path.file_name().and_then(|s| s.to_str()) {
        Some(name) => name,
        None => {
            debug!("Path has no valid filename: {}", path.display());
            return false;
        },
    };
    
    // Check for .zip or .zip.disabled extension
    let is_zip = file_name.ends_with(".zip") || file_name.ends_with(".zip.disabled");
    if is_zip {
        debug!("File confirmed as resource pack (zip): {}", path.display());
    } else {
        debug!("File is not a resource pack (not a zip): {}", path.display());
    }
    return is_zip;
} 