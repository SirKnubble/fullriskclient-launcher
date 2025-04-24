use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::AssetIndex;
use log::{debug, error, info, warn};
use std::path::{Path, PathBuf};
use tokio::fs;
use std::env;

/// Returns the path to the default .minecraft directory based on OS
pub fn get_default_minecraft_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        // Windows: %APPDATA%\.minecraft
        match env::var("APPDATA") {
            Ok(app_data) => PathBuf::from(app_data).join(".minecraft"),
            Err(_) => {
                warn!("[MC Utils] Failed to get APPDATA environment variable");
                // Fallback to user profile directory
                match dirs::home_dir() {
                    Some(home) => home.join("AppData").join("Roaming").join(".minecraft"),
                    None => PathBuf::new(), // Empty path if we can't find it
                }
            }
        }
    } else if cfg!(target_os = "macos") {
        // macOS: ~/Library/Application Support/minecraft
        match dirs::home_dir() {
            Some(home) => home.join("Library").join("Application Support").join("minecraft"),
            None => PathBuf::new(),
        }
    } else {
        // Linux and others: ~/.minecraft
        match dirs::home_dir() {
            Some(home) => home.join(".minecraft"),
            None => PathBuf::new(),
        }
    }
}

/// Checks if standard Minecraft assets can be reused and copies them if possible
/// Returns Ok(true) if assets were copied, Ok(false) if they weren't
pub async fn try_reuse_minecraft_assets(asset_index: &AssetIndex) -> Result<bool> {
    // Log what we're trying to do
    info!("[MC Utils] Checking for existing Minecraft assets (index: {})", asset_index.id);
    
    // Get paths
    let default_mc_dir = get_default_minecraft_dir();
    if !default_mc_dir.exists() {
        info!("[MC Utils] Default Minecraft directory not found at: {}", default_mc_dir.display());
        return Ok(false);
    }
    
    let source_indexes_dir = default_mc_dir.join("assets").join("indexes");
    let source_index_file = source_indexes_dir.join(format!("{}.json", asset_index.id));
    
    // Check if the source index file exists
    if !source_index_file.exists() {
        info!("[MC Utils] Asset index file not found at: {}", source_index_file.display());
        return Ok(false);
    }
    
    // Get destination dirs
    let dest_assets_dir = LAUNCHER_DIRECTORY.meta_dir().join("assets");
    let dest_indexes_dir = dest_assets_dir.join("indexes");
    let dest_index_file = dest_indexes_dir.join(format!("{}.json", asset_index.id));
    
    // Check if we already have the assets
    if dest_index_file.exists() {
        debug!("[MC Utils] Asset index already exists in launcher directory");
        
        // Check if size matches
        match fs::metadata(&dest_index_file).await {
            Ok(metadata) => {
                if metadata.len() as i64 == asset_index.size {
                    info!("[MC Utils] Asset index already exists with correct size, no need to copy");
                    return Ok(false); // Already have it with correct size
                }
                info!("[MC Utils] Asset index exists but size mismatch, will copy from default MC dir");
            },
            Err(e) => {
                warn!("[MC Utils] Failed to get metadata for existing asset index: {}", e);
            }
        }
    }
    
    // Create destination directories if they don't exist
    info!("[MC Utils] Creating asset directories if needed");
    fs::create_dir_all(&dest_indexes_dir).await?;
    fs::create_dir_all(dest_assets_dir.join("objects")).await?;
    
    // Copy the index file
    info!("[MC Utils] Copying asset index from: {}", source_index_file.display());
    match fs::copy(&source_index_file, &dest_index_file).await {
        Ok(_) => {
            info!("[MC Utils] Successfully copied asset index file");
        },
        Err(e) => {
            error!("[MC Utils] Failed to copy asset index file: {}", e);
            return Err(AppError::Io(e));
        }
    }
    
    // Copy the assets (objects)
    let source_objects_dir = default_mc_dir.join("assets").join("objects");
    let dest_objects_dir = dest_assets_dir.join("objects");
    
    if !source_objects_dir.exists() {
        warn!("[MC Utils] Source objects directory not found at: {}", source_objects_dir.display());
        // Still return Ok(true) because we copied the index file
        return Ok(true);
    }
    
    // Read index file to get list of objects
    let index_content = fs::read_to_string(&dest_index_file).await?;
    let index_json: serde_json::Value = serde_json::from_str(&index_content)?;
    
    // Extract the objects
    if let Some(objects) = index_json.get("objects").and_then(|o| o.as_object()) {
        info!("[MC Utils] Found {} assets to copy", objects.len());
        
        let mut copied_count = 0;
        let mut skipped_count = 0;
        let mut error_count = 0;
        
        for (_, object) in objects {
            if let (Some(hash), Some(size)) = (object.get("hash").and_then(|h| h.as_str()), 
                                               object.get("size").and_then(|s| s.as_i64())) {
                // Create hash folder (first 2 chars of hash)
                let hash_prefix = &hash[0..2];
                let source_hash_dir = source_objects_dir.join(hash_prefix);
                let dest_hash_dir = dest_objects_dir.join(hash_prefix);
                
                // Create destination hash directory if it doesn't exist
                if !dest_hash_dir.exists() {
                    if let Err(e) = fs::create_dir_all(&dest_hash_dir).await {
                        error!("[MC Utils] Failed to create hash directory {}: {}", dest_hash_dir.display(), e);
                        error_count += 1;
                        continue;
                    }
                }
                
                let source_file = source_hash_dir.join(hash);
                let dest_file = dest_hash_dir.join(hash);
                
                // Skip if dest file already exists with correct size
                if dest_file.exists() {
                    match fs::metadata(&dest_file).await {
                        Ok(metadata) => {
                            if metadata.len() as i64 == size {
                                debug!("[MC Utils] Asset already exists with correct size: {}", hash);
                                skipped_count += 1;
                                continue;
                            }
                        },
                        Err(e) => {
                            warn!("[MC Utils] Failed to get metadata for existing asset: {}", e);
                        }
                    }
                }
                
                // Copy the file
                if source_file.exists() {
                    match fs::copy(&source_file, &dest_file).await {
                        Ok(_) => {
                            debug!("[MC Utils] Copied asset: {}", hash);
                            copied_count += 1;
                        },
                        Err(e) => {
                            error!("[MC Utils] Failed to copy asset {}: {}", hash, e);
                            error_count += 1;
                        }
                    }
                } else {
                    debug!("[MC Utils] Source asset not found: {}", source_file.display());
                    error_count += 1;
                }
            }
        }
        
        info!("[MC Utils] Assets copy summary: copied {}, skipped {}, errors {}", 
              copied_count, skipped_count, error_count);
    } else {
        warn!("[MC Utils] Failed to parse objects from asset index");
    }
    
    Ok(true)
} 