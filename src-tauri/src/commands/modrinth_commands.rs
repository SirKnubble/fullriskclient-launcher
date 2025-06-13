use crate::commands::path_commands::UploadProfileImagesPayload;
use crate::error::{AppError, CommandError};
use crate::integrations::modrinth::{
    self, get_mod_versions as get_modrinth_versions_api, search_mods, search_projects,
    ModrinthBulkUpdateRequestBody, ModrinthProjectContext, ModrinthProjectType, ModrinthSearchHit,
    ModrinthSearchResponse, ModrinthSortType, ModrinthVersion,
};
use crate::integrations::mrpack;
use serde::Serialize;
use std::collections::HashMap;
use uuid::Uuid;

#[tauri::command]
pub async fn search_modrinth_projects(
    query: String,
    project_type: ModrinthProjectType,
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    sort: Option<ModrinthSortType>,
    categories_filter: Option<Vec<String>>,
    client_side_filter: Option<String>,
    server_side_filter: Option<String>,
) -> Result<ModrinthSearchResponse, CommandError> {
    log::debug!(
        "Received search_modrinth_projects command: query={}, project_type={:?}, version={}, loader={}, limit={:?}, offset={:?}, sort={:?}, categories={:?}, client_side={:?}, server_side={:?}",
        query,
        project_type,
        game_version.as_deref().unwrap_or("None"),
        loader.as_deref().unwrap_or("None"),
        limit,
        offset,
        sort,
        categories_filter,
        client_side_filter,
        server_side_filter
    );

    let result = search_projects(
        query,
        project_type,
        game_version,
        loader,
        limit,
        offset,
        sort,
        categories_filter,
        client_side_filter,
        server_side_filter,
    )
    .await
    .map_err(CommandError::from)?;

    Ok(result)
}

#[tauri::command]
pub async fn search_modrinth_mods(
    query: String,
    game_version: Option<String>,
    loader: Option<String>, // Expects loader identifier like "fabric", "forge", "quilt", "neoforge"
    limit: Option<u32>,
) -> Result<Vec<ModrinthSearchHit>, CommandError> {
    // Keep CommandError for consistency if used elsewhere
    // Call the actual API function from the integrations module
    log::debug!(
        "Received search_modrinth_mods command: query={}, version={}, loader={}, limit={:?}",
        query,
        game_version.as_deref().unwrap_or("None"),
        loader.as_deref().unwrap_or("None"),
        limit
    );
    // Use map_err to convert AppError to CommandError if necessary, or adjust Result type
    let result = search_mods(query, game_version, loader, limit)
        .await
        .map_err(CommandError::from)?;
    Ok(result)
}

#[tauri::command]
pub async fn get_modrinth_mod_versions(
    project_id_or_slug: String,
    loaders: Option<Vec<String>>,
    game_versions: Option<Vec<String>>,
) -> Result<Vec<ModrinthVersion>, CommandError> {
    // Return CommandError for Tauri
    log::debug!(
        "Received get_modrinth_mod_versions command: project_id={}, loaders={:?}, game_versions={:?}",
        project_id_or_slug,
        loaders,
        game_versions
    );
    // Call the actual API function and map error to CommandError
    get_modrinth_versions_api(project_id_or_slug, loaders, game_versions)
        .await
        .map_err(CommandError::from)
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
        .map(|(context, versions_result)| match versions_result {
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
    download_url: String,
    icon_url: Option<String>,
) -> Result<Uuid, CommandError> {
    log::info!(
        "Executing download_and_install_modrinth_modpack for project \"{}\", version \"{}\", icon_url: {:?}",
        project_id,
        version_id,
        icon_url
    );

    // Ensure the file name has .mrpack extension
    let file_name_mrpack = if !file_name.ends_with(".mrpack") {
        format!("{}.mrpack", file_name)
    } else {
        file_name.clone() // Clone if already correct to ensure ownership for logging later if needed
    };

    let profile_id_uuid = mrpack::download_and_process_mrpack(&download_url, &file_name_mrpack)
        .await
        .map_err(|e| {
            log::error!("Failed to download and process modpack: {}", e);
            CommandError::from(e)
        })?;

    log::info!(
        "Successfully downloaded and installed modpack \"{}\" as profile with ID: {}",
        file_name_mrpack, // Use the potentially suffixed name
        profile_id_uuid
    );

    // If an icon URL was provided, attempt to download and set it for the new profile
    if let Some(url_str) = icon_url {
        log::info!(
            "Attempting to set profile icon from URL: {} for profile {}",
            url_str,
            profile_id_uuid
        );

        let icon_payload = UploadProfileImagesPayload {
            path: None,
            profile_id: profile_id_uuid, // This is already a Uuid
            icon_url: Some(url_str.clone()),
            image_type: "icon".to_string(),
        };

        match crate::commands::path_commands::upload_profile_images(icon_payload).await {
            Ok(relative_icon_path) => {
                log::info!(
                    "Successfully set profile icon from URL for profile {}. Icon at: {}",
                    profile_id_uuid,
                    relative_icon_path
                );
            }
            Err(e) => {
                log::error!(
                    "Failed to set profile icon from URL {} for profile {}: {:?}",
                    url_str,
                    profile_id_uuid,
                    e
                );
                // Do not fail the whole modpack installation for an icon error, just log it.
            }
        }
    }

    // Return the new profile ID
    Ok(profile_id_uuid)
}

/// Fetches details for multiple Modrinth projects based on their IDs or slugs.
#[tauri::command]
pub async fn get_modrinth_project_details(
    ids: Vec<String>,
) -> Result<Vec<modrinth::ModrinthProject>, CommandError> {
    log::debug!(
        "Received get_modrinth_project_details_bulk command for {} project IDs/slugs",
        ids.len()
    );

    let result = modrinth::get_multiple_projects(ids).await?;
    Ok(result)
}

/// Efficiently checks for updates to multiple mods using a single API call.
/// Takes hashes of current mod files and returns the latest available versions.
/// Mods without updates or not found on Modrinth are omitted from the results.
#[tauri::command]
pub async fn check_modrinth_updates(
    request: ModrinthBulkUpdateRequestBody,
) -> Result<HashMap<String, ModrinthVersion>, CommandError> {
    log::debug!(
        "Received check_modrinth_updates command for {} mod hashes",
        request.hashes.len()
    );

    // Call the actual API function from the integrations module
    let updates = modrinth::check_bulk_updates(request)
        .await
        .map_err(CommandError::from)?;

    log::info!("Found updates for {} mods", updates.len());

    Ok(updates)
}

/// Fetches a list of all categories from Modrinth.
#[tauri::command]
pub async fn get_modrinth_categories_command(
) -> Result<Vec<modrinth::ModrinthCategory>, CommandError> {
    log::debug!("Received get_modrinth_categories_command");

    let categories = modrinth::get_modrinth_categories()
        .await
        .map_err(CommandError::from)?;

    log::info!(
        "Successfully fetched {} categories for frontend",
        categories.len()
    );
    Ok(categories)
}

/// Fetches a list of all loaders from Modrinth.
#[tauri::command]
pub async fn get_modrinth_loaders_command() -> Result<Vec<modrinth::ModrinthLoader>, CommandError> {
    log::debug!("Received get_modrinth_loaders_command");

    let loaders = modrinth::get_modrinth_loaders()
        .await
        .map_err(CommandError::from)?;

    log::info!(
        "Successfully fetched {} loaders for frontend",
        loaders.len()
    );
    Ok(loaders)
}

/// Fetches a list of all game versions from Modrinth.
#[tauri::command]
pub async fn get_modrinth_game_versions_command(
) -> Result<Vec<modrinth::ModrinthGameVersion>, CommandError> {
    log::debug!("Received get_modrinth_game_versions_command");

    let game_versions = modrinth::get_modrinth_game_versions()
        .await
        .map_err(CommandError::from)?;

    log::info!(
        "Successfully fetched {} game versions for frontend",
        game_versions.len()
    );
    Ok(game_versions)
}

/// Fetches Modrinth version details for a given list of SHA1 hashes.
#[tauri::command]
pub async fn get_modrinth_versions_by_hashes(
    hashes: Vec<String>,
    // hash_algorithm: String, // Modrinth API for versions by hash is specific to SHA1 currently
) -> Result<HashMap<String, ModrinthVersion>, CommandError> {
    log::debug!(
        "Received get_modrinth_versions_by_hashes command for {} hashes",
        hashes.len()
    );

    if hashes.is_empty() {
        return Ok(HashMap::new()); // Return empty map if no hashes are provided
    }

    // The modrinth::get_versions_by_hashes function expects "sha1" as the algorithm.
    let versions_map = modrinth::get_versions_by_hashes(hashes, "sha1")
        .await
        .map_err(CommandError::from)?;

    log::info!(
        "Modrinth lookup by hash returned {} matches",
        versions_map.len()
    );
    Ok(versions_map)
}
