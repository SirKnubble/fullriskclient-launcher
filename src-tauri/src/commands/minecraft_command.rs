use crate::minecraft::api::mc_api::MinecraftApiService;
use crate::error::CommandError;
use crate::minecraft::dto::VersionManifest;
use crate::minecraft::api::mclogs_api::upload_log_to_mclogs;
use crate::minecraft::api::fabric_api::FabricApi;
use crate::minecraft::dto::fabric_meta::FabricVersionInfo;
use crate::minecraft::api::forge_api::ForgeApi;
use crate::minecraft::dto::forge_maven_meta::ForgeMavenMetadata;

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
pub async fn get_forge_versions(minecraft_version: String) -> Result<Vec<String>, CommandError> {
    let forge_api = ForgeApi::new();
    let metadata = forge_api.get_all_versions()
        .await
        .map_err(CommandError::from)?;
    
    let filtered_versions = metadata.get_versions_for_minecraft(&minecraft_version);
    Ok(filtered_versions)
}