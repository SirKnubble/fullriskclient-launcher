use crate::error::{AppError, CommandError};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tokio::fs;
use log::{debug, info, warn};

/// Parameters for enabling/disabling a file
#[derive(Deserialize)]
pub struct SetFileEnabledParams {
    /// Full path to the file
    file_path: String,
    /// Whether the file should be enabled (true) or disabled (false)
    enabled: bool,
}

/// Parameters for deleting a file
#[derive(Deserialize)]
pub struct DeleteFileParams {
    /// Full path to the file
    file_path: String,
}

/// Sets a file as enabled or disabled by adding or removing the .disabled extension
#[tauri::command]
pub async fn set_file_enabled(params: SetFileEnabledParams) -> Result<(), CommandError> {
    let path = PathBuf::from(&params.file_path);
    info!("Setting file '{}' enabled={}", path.display(), params.enabled);

    if !path.exists() {
        return Err(CommandError::from(AppError::Other(format!("File not found: {}", path.display()))));
    }

    let file_name = match path.file_name().and_then(|name| name.to_str()) {
        Some(name) => name.to_string(),
        None => return Err(CommandError::from(AppError::Other("Invalid file name".to_string()))),
    };

    let parent = match path.parent() {
        Some(parent) => parent,
        None => return Err(CommandError::from(AppError::Other("Invalid file path".to_string()))),
    };

    // Check if the file is already in the desired state
    let is_disabled = file_name.ends_with(".disabled");
    if is_disabled == !params.enabled {
        debug!("File is already in the desired state: {}", path.display());
        return Ok(());
    }

    // Determine the new file name based on the 'enabled' parameter
    let new_file_name = if params.enabled {
        // Remove the .disabled extension
        if is_disabled {
            file_name.strip_suffix(".disabled").unwrap_or(&file_name).to_string()
        } else {
            file_name
        }
    } else {
        // Add the .disabled extension if it doesn't already have it
        if !is_disabled {
            format!("{}.disabled", file_name)
        } else {
            file_name
        }
    };

    let new_path = parent.join(new_file_name);
    debug!("Renaming file from '{}' to '{}'", path.display(), new_path.display());

    // Rename the file
    fs::rename(&path, &new_path).await.map_err(|e| {
        CommandError::from(AppError::Io(e))
    })?;

    info!("Successfully set file '{}' enabled={}", path.display(), params.enabled);
    Ok(())
}

/// Deletes a file from the filesystem
#[tauri::command]
pub async fn delete_file(params: DeleteFileParams) -> Result<(), CommandError> {
    let path = PathBuf::from(&params.file_path);
    info!("Deleting file: {}", path.display());

    if !path.exists() {
        return Err(CommandError::from(AppError::Other(format!("File not found: {}", path.display()))));
    }

    // Check if it's a file or directory
    let metadata = fs::metadata(&path).await.map_err(|e| {
        CommandError::from(AppError::Io(e))
    })?;

    if metadata.is_dir() {
        debug!("Deleting directory: {}", path.display());
        fs::remove_dir_all(&path).await.map_err(|e| {
            CommandError::from(AppError::Io(e))
        })?;
    } else {
        debug!("Deleting file: {}", path.display());
        fs::remove_file(&path).await.map_err(|e| {
            CommandError::from(AppError::Io(e))
        })?;
    }

    info!("Successfully deleted: {}", path.display());
    Ok(())
} 