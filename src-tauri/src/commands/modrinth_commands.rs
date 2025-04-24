use crate::error::{CommandError, AppError};
use crate::integrations::modrinth::{self, ModrinthProjectContext, search_mods, search_projects, ModrinthSearchHit, ModrinthSearchResponse, get_mod_versions as get_modrinth_versions_api, ModrinthVersion, ModrinthProjectType, ModrinthSortType};
use crate::integrations::mrpack;
use serde::Serialize;
use uuid::Uuid;
use std::collections::HashMap;

#[tauri::command]
pub async fn search_modrinth_projects(
    query: String,
    project_type: ModrinthProjectType,
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    sort: Option<ModrinthSortType>,
) -> Result<ModrinthSearchResponse, CommandError> {
    log::debug!(
        "Received search_modrinth_projects command: query={}, project_type={:?}, version={}, loader={}, limit={:?}, offset={:?}, sort={:?}",
        query,
        project_type,
        game_version.as_deref().unwrap_or("None"),
        loader.as_deref().unwrap_or("None"),
        limit,
        offset,
        sort
    );

    let result = search_projects(
        query,
        project_type,
        game_version,
        loader,
        limit,
        offset,
        sort
    ).await.map_err(CommandError::from)?;
    
    Ok(result)
}

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

/// Download and install a Modrinth modpack from its URL
#[tauri::command]
pub async fn download_and_install_modrinth_modpack(
    project_id: String,
    version_id: String,
    file_name: String,
    download_url: String
) -> Result<Uuid, CommandError> {
    log::info!(
        "Executing download_and_install_modrinth_modpack for project '{}', version '{}'",
        project_id, version_id
    );
    
    // Ensure the file name has .mrpack extension
    let file_name = if !file_name.ends_with(".mrpack") {
        format!("{}.mrpack", file_name)
    } else {
        file_name
    };
    
    let profile_id = mrpack::download_and_process_mrpack(&download_url, &file_name)
        .await
        .map_err(|e| {
            log::error!("Failed to download and process modpack: {}", e);
            CommandError::from(e)
        })?;
    
    // Log success
    log::info!(
        "Successfully downloaded and installed modpack '{}' as profile with ID: {}",
        file_name, profile_id
    );
    
    // Return the new profile ID
    Ok(profile_id)
}
