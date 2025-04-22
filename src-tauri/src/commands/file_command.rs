use crate::error::{AppError, CommandError};
use log::{debug, info};
use std::path::{PathBuf};
use tokio::fs;
use tauri_plugin_opener::OpenerExt;

/// Sets a file as enabled or disabled by adding or removing the .disabled extension
#[tauri::command]
pub async fn set_file_enabled(file_path: String, enabled: bool) -> Result<(), CommandError> {
    let path = PathBuf::from(&file_path);
    info!("Setting file '{}' enabled={}", path.display(), enabled);

    if !path.exists() {
        return Err(CommandError::from(AppError::Other(format!(
            "File not found: {}",
            path.display()
        ))));
    }

    let file_name = match path.file_name().and_then(|name| name.to_str()) {
        Some(name) => name.to_string(),
        None => {
            return Err(CommandError::from(AppError::Other(
                "Invalid file name".to_string(),
            )))
        }
    };

    let parent = match path.parent() {
        Some(parent) => parent,
        None => {
            return Err(CommandError::from(AppError::Other(
                "Invalid file path".to_string(),
            )))
        }
    };

    // Check if the file is already in the desired state
    let is_disabled = file_name.ends_with(".disabled");
    if is_disabled == !enabled {
        debug!("File is already in the desired state: {}", path.display());
        return Ok(());
    }

    // Determine the new file name based on the 'enabled' parameter
    let new_file_name = if enabled {
        // Remove the .disabled extension
        if is_disabled {
            file_name
                .strip_suffix(".disabled")
                .unwrap_or(&file_name)
                .to_string()
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
    debug!(
        "Renaming file from '{}' to '{}'",
        path.display(),
        new_path.display()
    );

    // Rename the file
    fs::rename(&path, &new_path)
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;

    info!(
        "Successfully set file '{}' enabled={}",
        path.display(),
        enabled
    );
    Ok(())
}

/// Deletes a file from the filesystem
#[tauri::command]
pub async fn delete_file(file_path: String) -> Result<(), CommandError> {
    let path = PathBuf::from(&file_path);
    info!("Deleting file: {}", path.display());

    if !path.exists() {
        return Err(CommandError::from(AppError::Other(format!(
            "File not found: {}",
            path.display()
        ))));
    }

    // Check if it's a file or directory
    let metadata = fs::metadata(&path)
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;

    if metadata.is_dir() {
        debug!("Deleting directory: {}", path.display());
        fs::remove_dir_all(&path)
            .await
            .map_err(|e| CommandError::from(AppError::Io(e)))?;
    } else {
        debug!("Deleting file: {}", path.display());
        fs::remove_file(&path)
            .await
            .map_err(|e| CommandError::from(AppError::Io(e)))?;
    }

    info!("Successfully deleted: {}", path.display());
    Ok(())
}

/// Opens the directory containing a file
#[tauri::command]
pub async fn open_file_directory(
    app_handle: tauri::AppHandle,
    file_path: String
) -> Result<(), CommandError> {
    let path = PathBuf::from(&file_path);
    info!("Opening directory for file: {}", path.display());

    if !path.exists() {
        return Err(CommandError::from(AppError::Other(format!(
            "File not found: {}",
            path.display()
        ))));
    }

    // Get the parent directory
    let parent_dir = match path.parent() {
        Some(parent) => parent,
        None => {
            return Err(CommandError::from(AppError::Other(
                "Could not determine parent directory".to_string(),
            )))
        }
    };

    debug!("Opening directory: {}", parent_dir.display());

    // Open the directory with the system file browser
    match app_handle
        .opener()
        .open_path(parent_dir.to_string_lossy(), None::<&str>)
    {
        Ok(_) => {
            info!("Successfully opened directory: {}", parent_dir.display());
            Ok(())
        }
        Err(e) => {
            info!("Failed to open directory {}: {}", parent_dir.display(), e);
            Err(CommandError::from(AppError::Other(format!(
                "Failed to open directory: {}",
                e
            ))))
        }
    }
}
