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
    // Construct the path to the resourcepacks directory
    let resourcepacks_dir = get_resourcepacks_dir(profile).await?;
    
    // Return empty list if directory doesn't exist yet
    if !resourcepacks_dir.exists() {
        debug!("Resourcepacks directory does not exist for profile: {}", profile.id);
        return Ok(Vec::new());
    }

    // Read directory contents
    let mut entries = fs::read_dir(&resourcepacks_dir).await
        .map_err(|e| AppError::Other(format!("Failed to read resourcepacks directory: {}", e)))?;
    
    let mut resourcepacks = Vec::new();
    let mut hashes = Vec::new();
    let mut path_to_info = HashMap::new();
    
    // Collect all .zip and .zip.disabled files
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| AppError::Other(format!("Failed to read resourcepack entry: {}", e)))? 
    {
        let path = entry.path();
        if is_resourcepack_file(&path) {
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
            
            let metadata = fs::metadata(&path).await
                .map_err(|e| AppError::Other(format!("Failed to get metadata for {}: {}", filename, e)))?;
            
            let file_size = metadata.len();

            // Hash the file
            let sha1_hash = match hash_utils::calculate_sha1(&path).await {
                Ok(hash) => {
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
        }
    }
    
    // If we have hashes, try to look them up on Modrinth
    if !hashes.is_empty() {
        match modrinth::get_versions_by_hashes(hashes, "sha1").await {
            Ok(version_map) => {
                for (hash, version) in version_map {
                    if let Some(info) = path_to_info.get_mut(&hash) {
                        // Check if this is actually a resourcepack and not something else
                        if version.project_id.is_empty() || version.project_id.is_empty() {
                            continue;
                        }
                        
                        // Find the primary file for the URL
                        if let Some(primary_file) = version.files.iter().find(|f| f.primary) {
                            info.modrinth_info = Some(ResourcePackModrinthInfo {
                                project_id: version.project_id.clone(),
                                version_id: version.id.clone(),
                                name: version.name.clone(),
                                version_number: version.version_number.clone(),
                                download_url: primary_file.url.clone(),
                            });
                        }
                    }
                }
            },
            Err(e) => {
                warn!("Failed to lookup resourcepacks on Modrinth: {}", e);
            }
        }
    }
    
    // Add all packs to the result list
    for (_, info) in path_to_info {
        resourcepacks.push(info);
    }
    
    Ok(resourcepacks)
}

/// Get the path to the resourcepacks directory for a profile
async fn get_resourcepacks_dir(profile: &Profile) -> Result<PathBuf> {
    let state = State::get().await?;
    let base_profiles_dir = state.profile_manager.calculate_instance_path_for_profile(profile)?;
    let profile_dir = base_profiles_dir.join(&profile.path);
    Ok(profile_dir.join("resourcepacks"))
}

/// Check if a path is a resourcepack file
fn is_resourcepack_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    
    let file_name = match path.file_name().and_then(|s| s.to_str()) {
        Some(name) => name,
        None => return false,
    };
    
    // Check for .zip or .zip.disabled extension
    file_name.ends_with(".zip") || file_name.ends_with(".zip.disabled")
} 