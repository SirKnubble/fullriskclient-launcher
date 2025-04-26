use crate::minecraft::api::mc_api::MinecraftApiService;
use crate::error::{AppError, CommandError};
use crate::minecraft::dto::VersionManifest;
use crate::minecraft::dto::minecraft_profile::MinecraftProfile;
use crate::minecraft::api::mclogs_api::upload_log_to_mclogs;
use crate::minecraft::api::fabric_api::FabricApi;
use crate::minecraft::dto::fabric_meta::FabricVersionInfo;
use crate::minecraft::api::quilt_api::QuiltApi;
use crate::minecraft::dto::quilt_meta::QuiltVersionInfo;
use crate::minecraft::api::forge_api::ForgeApi;
use crate::minecraft::api::neo_forge_api::NeoForgeApi;
use crate::state::state_manager::State;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn get_minecraft_versions() -> Result<VersionManifest, CommandError> {
    let api_service = MinecraftApiService::new();
    api_service.get_version_manifest()
        .await
        .map_err(|e| e.into())
}

#[tauri::command]
pub async fn upload_log_to_mclogs_command(log_content: String) -> Result<String, CommandError> {
    upload_log_to_mclogs(log_content)
        .await
        .map(|result| result.url)
        .map_err(|e| e.into())
}

#[tauri::command]
pub async fn get_fabric_loader_versions(minecraft_version: String) -> Result<Vec<FabricVersionInfo>, CommandError> {
    let fabric_api = FabricApi::new();
    fabric_api.get_loader_versions(&minecraft_version)
        .await
        .map_err(|e| e.into())
}

#[tauri::command]
pub async fn get_quilt_loader_versions(minecraft_version: String) -> Result<Vec<QuiltVersionInfo>, CommandError> {
    let quilt_api = QuiltApi::new();
    quilt_api.get_loader_versions(&minecraft_version)
        .await
        .map_err(|e| e.into())
}

#[tauri::command]
pub async fn get_forge_versions(minecraft_version: String) -> Result<Vec<String>, CommandError> {
    let forge_api = ForgeApi::new();
    let metadata = forge_api.get_all_versions()
        .await
        .map_err(CommandError::from)?;
    
    let filtered_versions = metadata.get_versions_for_minecraft(&minecraft_version);
    Ok(filtered_versions)
}

#[tauri::command]
pub async fn get_neoforge_versions(minecraft_version: String) -> Result<Vec<String>, CommandError> {
    let neo_forge_api = NeoForgeApi::new();
    let metadata = neo_forge_api.get_all_versions()
        .await
        .map_err(CommandError::from)?;
    
    let filtered_versions = metadata.get_versions_for_minecraft(&minecraft_version);
    Ok(filtered_versions)
}

/// Get the current user skin data
#[tauri::command]
pub async fn get_user_skin_data(uuid: String, access_token: String) -> Result<MinecraftProfile, CommandError> {
    let api_service = MinecraftApiService::new();
    
    let skin_data = api_service.get_user_profile(&uuid)
        .await
        .map_err(CommandError::from)?;
        
    Ok(skin_data)
}

/// Upload a new skin
#[tauri::command]
pub async fn upload_skin<R: tauri::Runtime>(
    uuid: String,
    access_token: String,
    skin_variant: String,
    app: tauri::AppHandle<R>,
) -> Result<(), CommandError> {
    // Validate skin variant
    if skin_variant != "classic" && skin_variant != "slim" {
        return Err(CommandError::from(
            AppError::Other(format!("Invalid skin variant. Must be 'classic' or 'slim'"))
        ));
    }
    
    // Spawn the blocking dialog call onto a blocking thread pool
    let dialog_result = tokio::task::spawn_blocking(move || {
        app.dialog()
           .file()
           .add_filter("PNG Image", &["png"])
           .set_title("Select Minecraft Skin File")
           .blocking_pick_file()
    })
    .await
    .map_err(|e| CommandError::from(AppError::Other(format!("Dialog task failed: {}", e))))?;
    
    let skin_path = match dialog_result {
        Some(file_path_obj) => match file_path_obj.into_path() {
            Ok(path) => path,
            Err(e) => {
                return Err(CommandError::from(AppError::Other(
                    format!("Failed to convert selected file path: {}", e)
                )));
            }
        },
        None => return Err(CommandError::from(
            AppError::Other("No skin file selected".to_string())
        )),
    };
    
    // Create a new API service instance
    let api_service = MinecraftApiService::new();
    
    // Upload the skin
    api_service.change_skin(
        &access_token,
        &uuid,
        skin_path.to_str().unwrap_or(""),
        &skin_variant,
    ).await.map_err(CommandError::from)?;
    
    Ok(())
}

/// Reset skin to default
#[tauri::command]
pub async fn reset_skin(uuid: String, access_token: String) -> Result<(), CommandError> {
    // Create a new API service instance
    let api_service = MinecraftApiService::new();
    
    // Reset skin
    api_service.reset_skin(
        &access_token,
        &uuid
    ).await.map_err(CommandError::from)?;
    
    Ok(())
}