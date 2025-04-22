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
    // Construct the path to the shaderpacks directory
    let shaderpacks_dir = get_shaderpacks_dir(profile).await?;
    
    // Return empty list if directory doesn't exist yet
    if !shaderpacks_dir.exists() {
        debug!("Shaderpacks directory does not exist for profile: {}", profile.id);
        return Ok(Vec::new());
    }

    // Read directory contents
    let mut entries = fs::read_dir(&shaderpacks_dir).await
        .map_err(|e| AppError::Other(format!("Failed to read shaderpacks directory: {}", e)))?;
    
    let mut shaderpacks = Vec::new();
    let mut hashes = Vec::new();
    let mut path_to_info = HashMap::new();
    
    // Collect all valid shader files (.zip, .zip.disabled, directories)
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| AppError::Other(format!("Failed to read shaderpack entry: {}", e)))? 
    {
        let path = entry.path();
        if is_shaderpack_file(&path).await? {
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
            
            // Only hash files, not directories (shaders can be directories)
            let sha1_hash = if path.is_file() {
                match hash_utils::calculate_sha1(&path).await {
                    Ok(hash) => {
                        // Add to the list of hashes to check against Modrinth
                        hashes.push(hash.clone());
                        Some(hash)
                    },
                    Err(e) => {
                        warn!("Failed to compute SHA1 hash for shaderpack {}: {}", filename, e);
                        None
                    }
                }
            } else {
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
        }
    }
    
    // If we have hashes, try to look them up on Modrinth
    if !hashes.is_empty() {
        match modrinth::get_versions_by_hashes(hashes, "sha1").await {
            Ok(version_map) => {
                for (hash, version) in version_map {
                    if let Some(info) = path_to_info.get_mut(&hash) {
                        // Check if this is actually a shader and not something else
                        if version.project_id.is_empty() || version.project_id.is_empty() {
                            continue;
                        }
                        
                        // Find the primary file for the URL
                        if let Some(primary_file) = version.files.iter().find(|f| f.primary) {
                            info.modrinth_info = Some(ShaderPackModrinthInfo {
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
                warn!("Failed to lookup shaderpacks on Modrinth: {}", e);
            }
        }
    }
    
    // Add all packs to the result list
    for (_, info) in path_to_info {
        shaderpacks.push(info);
    }
    
    Ok(shaderpacks)
}

/// Get the path to the shaderpacks directory for a profile
async fn get_shaderpacks_dir(profile: &Profile) -> Result<PathBuf> {
    let state = State::get().await?;
    let base_profiles_dir = state.profile_manager.calculate_instance_path_for_profile(profile)?;
    let profile_dir = base_profiles_dir.join(&profile.path);
    Ok(profile_dir.join("shaderpacks"))
}

/// Check if a path is a shaderpack file/directory
async fn is_shaderpack_file(path: &Path) -> Result<bool> {
    let metadata = fs::metadata(path).await
        .map_err(|e| AppError::Other(format!("Failed to get metadata: {}", e)))?;
    
    // Shader packs can be directories or zip files
    if metadata.is_dir() {
        // Check if it contains files that make it a shader pack
        // (typically shaders/composite.fsh or similar)
        return Ok(is_shader_directory(path).await?);
    }
    
    if metadata.is_file() {
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(name) => name,
            None => return Ok(false),
        };
        
        // Check for .zip or .zip.disabled extension for shader zip files
        return Ok(file_name.ends_with(".zip") || file_name.ends_with(".zip.disabled"));
    }
    
    Ok(false)
}

/// Check if a directory contains shader files
async fn is_shader_directory(path: &Path) -> Result<bool> {
    // Look for common shader files in the right places
    let shader_dir = path.join("shaders");
    
    if !shader_dir.exists() {
        return Ok(false);
    }
    
    // Check for common shader files
    for common_file in &["composite.fsh", "final.fsh", "gbuffers_basic.fsh"] {
        if shader_dir.join(common_file).exists() {
            return Ok(true);
        }
    }
    
    // If we can't find specific files, check if there are any .fsh or .vsh files
    let mut entries = fs::read_dir(&shader_dir).await
        .map_err(|e| AppError::Other(format!("Failed to read shader directory: {}", e)))?;
    
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| AppError::Other(format!("Failed to read shader entry: {}", e)))? 
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(extension) = path.extension().and_then(|e| e.to_str()) {
                if extension == "fsh" || extension == "vsh" {
                    return Ok(true);
                }
            }
        }
    }
    
    Ok(false)
} 