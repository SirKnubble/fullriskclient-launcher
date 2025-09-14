use crate::error::CommandError;
use crate::integrations::curseforge::{
    get_mods_by_ids, GetModsByIdsRequestBody, CurseForgeModsResponse, CurseForgeMod
};
use serde::Serialize;

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
