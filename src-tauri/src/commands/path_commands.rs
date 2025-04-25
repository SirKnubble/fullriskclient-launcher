use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::error::{AppError, CommandError};
use crate::state::profile_state::{ImageSource, ProfileManager};
use crate::state::state_manager::State;
use log::{debug, error};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::command;

type Result<T> = std::result::Result<T, CommandError>;

/// Returns the root launcher directory path
#[command]
pub async fn get_launcher_directory() -> Result<String> {
    let path = LAUNCHER_DIRECTORY.root_dir();
    debug!("Returning launcher directory: {:?}", path);
    Ok(path.to_string_lossy().to_string())
}

/// Resolves an image path from various source types to an absolute file:// URL
/// This handles different ImageSource types and returns a format suitable for web display
#[command]
pub async fn resolve_image_path(app_handle: AppHandle, image_source: ImageSource, profile_id: Option<String>) -> Result<String> {
    debug!("Resolving image path: {:?} for profile: {:?}", image_source, profile_id);

    match image_source {
        // URL: Already in web-compatible format, just return
        ImageSource::Url { url } => {
            debug!("Using direct URL: {}", url);
            Ok(url)
        },

        // Base64: Format as a data URI
        ImageSource::Base64 { data, mime_type } => {
            let mime = mime_type.unwrap_or_else(|| "image/png".to_string());
            debug!("Using Base64 data with MIME type: {}", mime);
            
            // Ensure data is properly formatted (no line breaks, etc.)
            let clean_data = data.replace("\n", "").replace("\r", "").replace(" ", "");
            
            // Return as a properly formatted data URI
            Ok(format!("data:{};base64,{}", mime, clean_data))
        },

        // RelativePath: Relative to launcher directory
        ImageSource::RelativePath { path } => {
            let launcher_dir = LAUNCHER_DIRECTORY.root_dir();
            let full_path = launcher_dir.join(path);
            
            debug!("Resolved relative path to: {:?}", full_path);
            if !full_path.exists() {
                error!("Image file does not exist: {:?}", full_path);
                // Return an error instead of a fallback image
                return Err(AppError::Other(format!("Image file does not exist: {:?}", full_path)).into());
            }
            
            Ok(format!("file://{}", full_path.to_string_lossy()))
        },

        // RelativeProfile: Relative to profile directory
        ImageSource::RelativeProfile { path } => {
            // We need a profile ID for this type
            if profile_id.is_none() {
                error!("Profile ID is required for relativeProfile image source");
                return Err(AppError::Other("Profile ID is required for relativeProfile image source".to_string()).into());
            }

            let state = State::get().await?;
            let profile_manager = &state.profile_manager;
            
            // Parse UUID
            let profile_uuid = match uuid::Uuid::parse_str(&profile_id.unwrap()) {
                Ok(uuid) => uuid,
                Err(e) => {
                    error!("Failed to parse profile UUID: {}", e);
                    return Err(AppError::Other(format!("Failed to parse profile UUID: {}", e)).into());
                }
            };
            
            // Get profile path
            let profile_path = profile_manager.get_profile_instance_path(profile_uuid).await?;
            let full_path = profile_path.join(path);
            
            debug!("Resolved profile-relative path to: {:?}", full_path);
            if !full_path.exists() {
                error!("Image file does not exist: {:?}", full_path);
                return Err(AppError::Other(format!("Image file does not exist: {:?}", full_path)).into());
            }
            
            Ok(format!("file://{}", full_path.to_string_lossy()))
        },

        // AbsolutePath: Already a complete path, just convert to URL
        ImageSource::AbsolutePath { path } => {
            let path_buf = PathBuf::from(path);
            
            debug!("Using absolute path: {:?}", path_buf);
            if !path_buf.exists() {
                error!("Image file does not exist: {:?}", path_buf);
                return Err(AppError::Other(format!("Image file does not exist: {:?}", path_buf)).into());
            }
            
            Ok(format!("file://{}", path_buf.to_string_lossy()))
        }
    }
} 