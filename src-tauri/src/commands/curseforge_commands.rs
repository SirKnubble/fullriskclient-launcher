use crate::error::{AppError, CommandError};
use crate::integrations::curseforge::{
    get_mods_by_ids, GetModsByIdsRequestBody, CurseForgeModsResponse, CurseForgeMod,
    import_curseforge_pack_as_profile, download_and_install_curseforge_modpack
};
use serde::Serialize;
use std::path::PathBuf;

#[tauri::command]
pub async fn get_curseforge_mods_by_ids(
    mod_ids: Vec<u32>,
    filter_pc_only: Option<bool>,
) -> Result<CurseForgeModsResponse, CommandError> {
    log::debug!(
        "Received get_curseforge_mods_by_ids command for {} mod IDs",
        mod_ids.len()
    );

    let result = get_mods_by_ids(mod_ids, filter_pc_only)
        .await
        .map_err(CommandError::from)?;

    log::info!(
        "Successfully retrieved {} CurseForge mods",
        result.data.len()
    );

    Ok(result)
}


/// Import a CurseForge modpack as a new profile
#[tauri::command]
pub async fn import_curseforge_pack(pack_path: String) -> Result<String, CommandError> {
    log::debug!("Received import_curseforge_pack command for path: {}", pack_path);

    let path_buf = PathBuf::from(&pack_path);

    // Check if file exists
    if !path_buf.exists() {
        return Err(CommandError::from(AppError::Other(format!("Pack file does not exist: {}", pack_path))));
    }

    // Check if it's a file
    if !path_buf.is_file() {
        return Err(CommandError::from(AppError::Other(format!("Path is not a file: {}", pack_path))));
    }

    // Import the pack
    let profile_id = import_curseforge_pack_as_profile(path_buf)
        .await
        .map_err(CommandError::from)?;

    log::info!("Successfully imported CurseForge pack as profile with ID: {}", profile_id);

    Ok(profile_id.to_string())
}

/// Download and install a CurseForge modpack from its URL
#[tauri::command]
pub async fn download_and_install_curseforge_modpack_command(
    project_id: u32,
    file_id: u32,
    file_name: String,
    download_url: String,
    icon_url: Option<String>,
) -> Result<String, CommandError> {
    log::info!(
        "Executing download_and_install_curseforge_modpack for project {}, file {}, icon_url: {:?}",
        project_id, file_id, icon_url
    );

    let profile_id_uuid = download_and_install_curseforge_modpack(
        project_id,
        file_id,
        file_name,
        download_url,
        icon_url,
    )
    .await
    .map_err(|e| {
        log::error!("Failed to download and install CurseForge modpack: {}", e);
        CommandError::from(e)
    })?;

    log::info!(
        "Successfully downloaded and installed CurseForge modpack as profile with ID: {}",
        profile_id_uuid
    );

    Ok(profile_id_uuid.to_string())
}
