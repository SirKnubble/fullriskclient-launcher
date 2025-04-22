use crate::error::{AppError, CommandError};
use crate::integrations::modrinth::ModrinthVersion;
use crate::integrations::mrpack;
use crate::integrations::norisk_packs::NoriskModpacksConfig;
use crate::minecraft::installer;
use crate::state::profile_state::{
    default_profile_path, CustomModInfo, ModLoader, Profile, ProfileSettings, ProfileState};
use crate::state::state_manager::State;
use crate::utils::path_utils::find_unique_profile_segment;
use chrono::Utc;
use log::info;
use sanitize_filename::sanitize;
use serde::Deserialize;
use std::collections::HashSet;
use sysinfo::System;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tokio::fs as TokioFs;
use uuid::Uuid;
use crate::utils::{resourcepack_utils, shaderpack_utils, profile_utils};
use crate::integrations::modrinth::ModrinthProjectType;

// DTOs für Command-Parameter
#[derive(Deserialize)]
pub struct CreateProfileParams {
    name: String,
    game_version: String,
    loader: String,
    loader_version: Option<String>,
    selected_norisk_pack_id: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProfileParams {
    name: Option<String>,
    game_version: Option<String>,
    loader: Option<String>,
    loader_version: Option<String>,
    settings: Option<ProfileSettings>,
    selected_norisk_pack_id: Option<String>,
}

// CRUD Commands
#[tauri::command]
pub async fn create_profile(params: CreateProfileParams) -> Result<Uuid, CommandError> {
    let state = State::get().await?;

    // 1. Basis-Pfad für Profile bestimmen
    let base_profiles_dir = default_profile_path();
    // Stelle sicher, dass das Basisverzeichnis existiert (optional, aber gut)
    TokioFs::create_dir_all(&base_profiles_dir)
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;

    // 2. Gewünschten Segmentnamen bereinigen
    let sanitized_base_name = sanitize(&params.name);
    if sanitized_base_name.is_empty() {
        // Handle den Fall, dass der Name nach der Bereinigung leer ist
        // Z.B. einen Standardnamen verwenden oder Fehler zurückgeben
        return Err(CommandError::from(AppError::Other(
            "Profile name is invalid after sanitization.".to_string(),
        )));
    }

    // 3. Eindeutigen Segmentnamen finden
    let unique_segment =
        find_unique_profile_segment(&base_profiles_dir, &sanitized_base_name).await?;
    info!("Unique segment: {}", unique_segment);

    // 4. Profil-Pfad konstruieren
    // Annahme: profile.path speichert nur das Segment (den Ordnernamen)
    let profile_path = unique_segment;

    TokioFs::create_dir_all(&base_profiles_dir.join(&profile_path))
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;

    let profile = Profile {
        id: Uuid::new_v4(),
        name: params.name.clone(), // Der Anzeigename bleibt original
        path: profile_path,        // Verwende den eindeutigen Pfad/Segment
        game_version: params.game_version.clone(),
        loader: ModLoader::from_str(&params.loader)?,
        loader_version: params.loader_version.clone(),
        created: Utc::now(),
        last_played: None,
        settings: ProfileSettings::default(),
        state: ProfileState::NotInstalled,
        mods: Vec::new(),
        selected_norisk_pack_id: params.selected_norisk_pack_id.clone(),
        disabled_norisk_mods_detailed: HashSet::new(),
    };

    let id = state.profile_manager.create_profile(profile).await?;
    Ok(id)
}

#[tauri::command]
pub async fn launch_profile(id: Uuid) -> Result<(), CommandError> {
    let state = State::get().await?;
    let mut profile = state.profile_manager.get_profile(id).await?;
    profile.last_played = Some(Utc::now());
    state
        .profile_manager
        .update_profile(id, profile.clone())
        .await?;

    let version = profile.game_version.clone();
    let modloader = profile.loader.clone();
    let credentials = match state
        .minecraft_account_manager_v2
        .get_active_account()
        .await
    {
        Ok(creds) => creds,
        Err(e) => {
            info!("Error getting active account: {}", e);
            None
        }
    };

    tokio::spawn(async move {
        match installer::install_minecraft_version(
            &version,
            &modloader.as_str(),
            &profile,
            credentials,
        )
        .await
        {
            Ok(_) => info!(
                "Successfully installed/launched Minecraft version {}",
                version
            ),
            Err(e) => info!("Error installing/launching Minecraft: {}", e),
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn get_profile(id: Uuid) -> Result<Profile, CommandError> {
    let state = State::get().await?;
    let profile = state.profile_manager.get_profile(id).await?;
    Ok(profile)
}

#[tauri::command]
pub async fn update_profile(id: Uuid, params: UpdateProfileParams) -> Result<(), CommandError> {
    let state = State::get().await?;
    let mut profile = state.profile_manager.get_profile(id).await?;

    if let Some(name) = params.name {
        profile.name = name;
    }
    if let Some(game_version) = params.game_version {
        profile.game_version = game_version;
    }
    if let Some(loader) = params.loader {
        profile.loader = ModLoader::from_str(&loader)?;
    }
    if let Some(loader_version) = params.loader_version {
        profile.loader_version = Some(loader_version);
    }
    if let Some(settings) = params.settings {
        profile.settings = settings;
    }
    profile.selected_norisk_pack_id = params.selected_norisk_pack_id;

    state.profile_manager.update_profile(id, profile).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_profile(id: Uuid) -> Result<(), CommandError> {
    let state = State::get().await?;
    state.profile_manager.delete_profile(id).await?;
    Ok(())
}

#[tauri::command]
pub async fn add_modrinth_mod_to_profile(
    profile_id: Uuid,
    project_id: String,
    version_id: String,
    file_name: String,
    download_url: String,
    file_hash_sha1: Option<String>,
    mod_name: Option<String>,
    version_number: Option<String>,
    loaders: Option<Vec<String>>,
    game_versions: Option<Vec<String>>,
) -> Result<(), CommandError> {
    info!(
        "Executing add_mod_to_profile command for profile {}",
        profile_id
    );

    Ok(State::get()
        .await?
        .profile_manager
        .add_modrinth_mod(
            profile_id,
            project_id,
            version_id,
            file_name,
            download_url,
            file_hash_sha1,
            mod_name,
            version_number,
            loaders,
            game_versions,
            true,
        )
        .await?)
}

#[tauri::command]
pub async fn list_profiles() -> Result<Vec<Profile>, CommandError> {
    let state = State::get().await?;
    let profiles = state.profile_manager.list_profiles().await?;
    Ok(profiles)
}

#[tauri::command]
pub async fn search_profiles(query: String) -> Result<Vec<Profile>, CommandError> {
    let state = State::get().await?;
    let profiles = state.profile_manager.search_profiles(&query).await?;
    Ok(profiles)
}

#[tauri::command]
pub async fn set_profile_mod_enabled(
    profile_id: Uuid,
    mod_id: Uuid,
    enabled: bool,
) -> Result<(), CommandError> {
    info!(
        "Received command set_profile_mod_enabled: profile={}, mod={}, enabled={}",
        profile_id, mod_id, enabled
    );
    let state = State::get().await?;
    state
        .profile_manager
        .set_mod_enabled(profile_id, mod_id, enabled)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_mod_from_profile(profile_id: Uuid, mod_id: Uuid) -> Result<(), CommandError> {
    info!(
        "Received command delete_mod_from_profile: profile={}, mod={}",
        profile_id, mod_id
    );
    let state = State::get().await?;
    state.profile_manager.delete_mod(profile_id, mod_id).await?;
    Ok(())
}

// Command to retrieve the list of available Norisk Modpacks
#[tauri::command]
pub async fn get_norisk_packs() -> Result<NoriskModpacksConfig, CommandError> {
    info!("Received command get_norisk_packs");
    let state = State::get().await?;
    let config = state.norisk_pack_manager.get_config().await;
    Ok(config)
}

#[tauri::command]
pub async fn set_norisk_mod_status(
    profile_id: Uuid,
    pack_id: String,
    mod_id: String,
    game_version: String,
    loader_str: String, // Receive loader as string from frontend
    disabled: bool,
) -> Result<(), CommandError> {
    info!(
        "Received command set_norisk_mod_status: profile={}, pack={}, mod={}, mc={}, loader={}, disabled={}",
        profile_id, pack_id, mod_id, game_version, loader_str, disabled
    );
    let state = State::get().await?;

    // Convert loader string to ModLoader enum
    let loader = ModLoader::from_str(&loader_str)?;

    state
        .profile_manager
        .set_norisk_mod_status(profile_id, pack_id, mod_id, game_version, loader, disabled)
        .await?;
    Ok(())
}

// Command to update the version of a Modrinth mod in a profile
#[tauri::command]
pub async fn update_modrinth_mod_version(
    profile_id: Uuid,
    mod_instance_id: Uuid, // The unique ID of the Mod instance in the profile's list
    new_version_details: ModrinthVersion, // Receive the full details of the target version
) -> Result<(), CommandError> {
    info!(
        "Received command update_modrinth_mod_version: profile={}, mod_instance={}, new_version_id={}",
        profile_id,
        mod_instance_id,
        new_version_details.id
    );
    let state = State::get().await?;
    state
        .profile_manager
        .update_profile_modrinth_mod_version(profile_id, mod_instance_id, &new_version_details) // Pass details by reference
        .await?;
    Ok(())
}

// --- Custom Mod Commands ---

#[tauri::command]
pub async fn get_custom_mods(profile_id: Uuid) -> Result<Vec<CustomModInfo>, CommandError> {
    log::info!(
        "Received get_custom_mods command for profile {}",
        profile_id
    );
    let state: std::sync::Arc<State> = State::get().await?;
    Ok(state.profile_manager.list_custom_mods(profile_id).await?)
}

#[tauri::command]
pub async fn set_custom_mod_enabled(
    profile_id: Uuid,
    filename: String,
    enabled: bool,
) -> Result<(), CommandError> {
    // Return Result<()> as the manager method does
    log::info!(
        "Received set_custom_mod_enabled command for profile {}, file '{}', set_enabled={}",
        profile_id,
        filename,
        enabled
    );
    let state: std::sync::Arc<State> = State::get().await?;
    Ok(state
        .profile_manager
        .set_custom_mod_enabled(profile_id, filename, enabled)
        .await?)
}

#[tauri::command]
pub async fn delete_custom_mod(profile_id: Uuid, filename: String) -> Result<(), CommandError> {
    log::info!(
        "Received delete_custom_mod command for profile {}, file '{}'",
        profile_id,
        filename
    );

    // Ensure the filename itself doesn't end with .disabled - we expect the base name.
    if filename.ends_with(".disabled") {
        log::warn!("delete_custom_mod called with filename ending in .disabled: '{}'. Please provide the base filename.", filename);
        return Err(CommandError::from(AppError::Other(format!(
            "Invalid filename provided to delete_custom_mod: {}",
            filename
        ))));
    }

    let state = State::get().await?;

    // Call the ProfileManager method to handle the deletion
    state
        .profile_manager
        .delete_custom_mod_file(profile_id, &filename)
        .await?;

    Ok(())
}

// --- New Command to get System RAM ---
#[tauri::command]
pub async fn get_system_ram_mb() -> Result<u64, CommandError> {
    log::info!("Received command get_system_ram_mb");
    // In a real application, you might want to manage the System instance
    // in the global state to avoid recreating it, but for a one-off command,
    // this is fine.
    let mut sys = System::new_all();
    sys.refresh_memory(); // Refresh memory information
    let total_memory_bytes = sys.total_memory();
    let total_memory_mb = total_memory_bytes / (1024 * 1024);
    Ok(total_memory_mb)
}

// --- New Command to open Profile Folder ---
#[tauri::command]
pub async fn open_profile_folder(
    app_handle: tauri::AppHandle,
    profile_id: Uuid,
) -> Result<(), CommandError> {
    log::info!(
        "Received command open_profile_folder for profile {}",
        profile_id
    );
    let state = State::get().await?;
    let profile = state.profile_manager.get_profile(profile_id).await?;

    // Construct the full path
    let base_profiles_dir = default_profile_path();
    let profile_full_path = base_profiles_dir.join(&profile.path);

    // Check if the directory exists (optional but good practice)
    if !profile_full_path.is_dir() {
        log::warn!(
            "Profile directory does not exist or is not a directory: {:?}",
            profile_full_path
        );
        return Err(CommandError::from(AppError::Other(format!(
            "Profile directory not found: {}",
            profile_full_path.display()
        ))));
    }

    log::info!("Attempting to open profile folder: {:?}", profile_full_path);

    match app_handle
        .opener()
        .open_path(profile_full_path.to_string_lossy(), None::<&str>)
    {
        Ok(_) => {
            log::info!(
                "Successfully requested to open profile folder: {:?}",
                profile_full_path
            );
            Ok(())
        }
        Err(e) => {
            log::error!(
                "Failed to open profile folder {:?}: {}",
                profile_full_path,
                e
            );
            Err(CommandError::from(AppError::Other(format!(
                "Failed to open folder: {}",
                e
            ))))
        }
    }
}

#[tauri::command]
pub async fn import_local_mods(
    app_handle: tauri::AppHandle,
    profile_id: Uuid,
) -> Result<(), CommandError> {
    log::info!(
        "Executing import_local_mods command for profile {}",
        profile_id
    );

    // Spawn the blocking dialog call onto a blocking thread pool
    let dialog_result_outer = tokio::task::spawn_blocking(move || {
        app_handle
            .dialog()
            .file()
            .add_filter("Java Archives", &["jar"])
            .set_title("Select Mod Jars to Import")
            .blocking_pick_files() // Use the blocking version inside spawn_blocking
    })
    .await
    .map_err(|e| CommandError::from(AppError::Other(format!("Dialog task failed: {}", e))))?;
    // The first ? handles JoinError

    if let Some(paths_enums) = dialog_result_outer {
        // Check if user selected files
        if paths_enums.is_empty() {
            log::info!("No files selected by user for import.");
            return Ok(());
        }
        log::info!(
            "User selected {} files to import for profile {}. Triggering processing...",
            paths_enums.len(),
            profile_id
        );

        // Call the ProfileManager method to handle the processing
        let state = State::get().await?;
        state
            .profile_manager
            .import_local_mods_to_profile(profile_id, paths_enums)
            .await?;
        // Propagate potential critical errors from the processing method

        // Emit event to trigger UI update for this profile
        if let Err(e) = state.event_state.trigger_profile_update(profile_id).await {
            // Log the error, but don't fail the whole command just because the event failed
            log::error!(
                "Failed to emit TriggerProfileUpdate event for profile {}: {}",
                profile_id,
                e
            );
        }

        // --- REMOVED processing logic (hashing, bulk lookup, adding/copying) ---

        // TODO: Decide if the frontend update event should be emitted here or within the ProfileManager method
        // It might be better in ProfileManager after processing is fully complete.
    } else {
        log::info!("User cancelled the file import dialog (blocking).");
    }

    Ok(())
}

#[tauri::command]
pub async fn import_profile_from_file(app_handle: tauri::AppHandle) -> Result<(), CommandError> {
    log::info!("Executing import_profile_from_file command");

    // Spawn the blocking dialog call onto a blocking thread pool
    let dialog_result = tokio::task::spawn_blocking(move || {
        app_handle
            .dialog()
            .file()
            .add_filter("Modrinth Modpack", &["mrpack"])
            .set_title("Select Modpack File (.mrpack)")
            .blocking_pick_file() // Use the blocking version for single file selection
    })
    .await
    .map_err(|e| CommandError::from(AppError::Other(format!("Dialog task failed: {}", e))))?;

    if let Some(file_path_obj) = dialog_result {
        // Convert FilePath to PathBuf
        let file_path_buf = match file_path_obj.into_path() {
            Ok(path) => path,
            Err(e) => {
                log::error!("Failed to convert selected file path: {}", e);
                return Err(CommandError::from(AppError::Other(
                    "Failed to convert selected file path".to_string(),
                )));
            }
        };

        log::info!(
            "User selected modpack file: {:?}. Triggering processing...",
            file_path_buf
        );

        // Check if the file extension is .mrpack (case-insensitive)
        if file_path_buf
            .extension()
            .and_then(|ext| ext.to_str())
            .map_or(false, |ext| ext.eq_ignore_ascii_case("mrpack"))
        {
            log::info!("File extension is .mrpack, proceeding with processing.");
            // Call the import function which returns the new profile ID
            let new_profile_id = mrpack::import_mrpack_as_profile(file_path_buf).await?;

            // Get state to emit event
            let state = State::get().await?;
            // Emit event to trigger UI update for the newly created profile
            if let Err(e) = state.event_state.trigger_profile_update(new_profile_id).await {
                log::error!("Failed to emit TriggerProfileUpdate event for new profile {}: {}", new_profile_id, e);
            }
            
            Ok(())
        } else {
            log::error!("Selected file is not a .mrpack file: {:?}", file_path_buf);
            Err(CommandError::from(AppError::Other(
                "Invalid file type selected. Please select a .mrpack file.".to_string(),
            )))
        }
    } else {
        log::info!("User cancelled the file import dialog.");
        Ok(())
    }
}

// Command to get all resourcepacks in a profile
#[tauri::command]
pub async fn get_local_resourcepacks(profile_id: Uuid) -> Result<Vec<resourcepack_utils::ResourcePackInfo>, CommandError> {
    log::info!("Executing get_local_resourcepacks command for profile {}", profile_id);
    
    let state = State::get().await?;
    let profile = state.profile_manager.get_profile(profile_id).await?;
    
    // Use the utility function to get all resourcepacks
    let resourcepacks = resourcepack_utils::get_resourcepacks_for_profile(&profile).await
        .map_err(|e| CommandError::from(e))?;
    
    Ok(resourcepacks)
}

// Command to get all shaderpacks in a profile
#[tauri::command]
pub async fn get_local_shaderpacks(profile_id: Uuid) -> Result<Vec<shaderpack_utils::ShaderPackInfo>, CommandError> {
    log::info!("Executing get_local_shaderpacks command for profile {}", profile_id);
    
    let state = State::get().await?;
    let profile = state.profile_manager.get_profile(profile_id).await?;
    
    // Use the utility function to get all shaderpacks
    let shaderpacks = shaderpack_utils::get_shaderpacks_for_profile(&profile).await
        .map_err(|e| CommandError::from(e))?;
    
    Ok(shaderpacks)
}

#[tauri::command]
pub async fn add_modrinth_content_to_profile(
    profile_id: Uuid,
    project_id: String,
    version_id: String,
    file_name: String,
    download_url: String,
    file_hash_sha1: Option<String>,
    content_name: Option<String>,
    version_number: Option<String>,
    project_type: String,
) -> Result<(), CommandError> {
    info!("Executing add_modrinth_content_to_profile for profile {}", profile_id);
    
    // Konvertiere den String project_type in ModrinthProjectType
    let content_type = match project_type.to_lowercase().as_str() {
        "resourcepack" => profile_utils::ContentType::ResourcePack,
        "shader" => profile_utils::ContentType::ShaderPack,
        "datapack" => profile_utils::ContentType::DataPack,
        _ => {
            return Err(CommandError::from(AppError::Other(format!(
                "Unsupported content type: {}",
                project_type
            ))));
        }
    };
    
    // Rufe die Implementierung auf
    profile_utils::add_modrinth_content_to_profile(
        profile_id,
        project_id,
        version_id,
        file_name,
        download_url,
        file_hash_sha1,
        content_name,
        version_number,
        content_type,
    )
    .await
    .map_err(CommandError::from)
}
