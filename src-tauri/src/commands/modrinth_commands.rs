use crate::error::{CommandError, AppError};
use crate::integrations::modrinth::{self, ModrinthProjectContext, search_mods, ModrinthSearchHit, get_mod_versions as get_modrinth_versions_api, ModrinthVersion};
use std::collections::HashMap;
use serde::Serialize;

#[tauri::command]
pub async fn search_modrinth_mods(
    query: String,
    game_version: Option<String>,
    loader: Option<String>, // Expects loader identifier like "fabric", "forge", "quilt", "neoforge"
    limit: Option<u32>,
) -> Result<Vec<ModrinthSearchHit>, CommandError> { // Keep CommandError for consistency if used elsewhere
    // Call the actual API function from the integrations module
    log::debug!(
        "Received search_modrinth_mods command: query={}, version={}, loader={}, limit={:?}",
        query,
        game_version.as_deref().unwrap_or("None"),
        loader.as_deref().unwrap_or("None"),
        limit
    );
    // Use map_err to convert AppError to CommandError if necessary, or adjust Result type
    let result = search_mods(query, game_version, loader, limit).await.map_err(CommandError::from)?;
    Ok(result)
}

#[tauri::command]
pub async fn get_modrinth_mod_versions(
    project_id_or_slug: String,
    loaders: Option<Vec<String>>,
    game_versions: Option<Vec<String>>,
) -> Result<Vec<ModrinthVersion>, CommandError> { // Return CommandError for Tauri
    log::debug!(
        "Received get_modrinth_mod_versions command: project_id={}, loaders={:?}, game_versions={:?}",
        project_id_or_slug,
        loaders,
        game_versions
    );
    // Call the actual API function and map error to CommandError
    get_modrinth_versions_api(project_id_or_slug, loaders, game_versions).await.map_err(CommandError::from)
}

#[derive(Serialize, Debug)]
pub struct ModrinthLatestVersionResult {
    context: ModrinthProjectContext,
    latest_version: Option<ModrinthVersion>,
}

#[derive(Serialize, Debug)]
pub struct ModrinthAllVersionsResult {
    context: ModrinthProjectContext,
    versions: Option<Vec<ModrinthVersion>>,
    error: Option<String>,
}

#[tauri::command]
pub async fn get_all_modrinth_versions_for_contexts(
    contexts: Vec<ModrinthProjectContext>,
) -> Result<Vec<ModrinthAllVersionsResult>, CommandError> {
    log::debug!(
        "Received get_all_modrinth_versions_for_contexts command for {} contexts",
        contexts.len()
    );

    let result_map: HashMap<ModrinthProjectContext, Result<Vec<ModrinthVersion>, AppError>> =
        match modrinth::get_all_versions_for_projects(contexts).await {
            Ok(map) => map,
            Err(e) => {
                log::error!("Error during bulk version fetch setup: {}", e);
                return Err(CommandError::from(e));
            }
        };
            
    let frontend_results: Vec<ModrinthAllVersionsResult> = result_map
        .into_iter()
        .map(|(context, versions_result)| {
            match versions_result {
                Ok(versions) => ModrinthAllVersionsResult {
                    context,
                    versions: Some(versions),
                    error: None,
                },
                Err(app_error) => ModrinthAllVersionsResult {
                    context,
                    versions: None,
                    error: Some(app_error.to_string()),
                },
            }
        })
        .collect();

    Ok(frontend_results)
}
