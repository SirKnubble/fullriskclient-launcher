use crate::error::{AppError, CommandError};
use crate::integrations::modrinth::ModrinthVersion;
use crate::integrations::mrpack;
use crate::integrations::norisk_packs::{NoriskModpacksConfig, import_noriskpack_as_profile};
use crate::integrations::norisk_versions::{self, NoriskVersionsConfig};
use crate::minecraft::installer;
use crate::state::profile_state::{
    default_profile_path, CustomModInfo, ModLoader, Profile, ProfileSettings, ProfileState,
};
use crate::state::state_manager::State;
use crate::utils::path_utils::find_unique_profile_segment;
use crate::utils::{profile_utils, resourcepack_utils, shaderpack_utils, path_utils};
use chrono::Utc;
use log::info;
use log::error;
use noriskclient_launcher_v3_lib::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use sanitize_filename::sanitize;
use serde::Deserialize;
use std::collections::HashSet;
use std::path::PathBuf;
use sysinfo::System;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tokio::fs as TokioFs;
use uuid::Uuid;

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

// Neue DTO für den copy_profile Command
#[derive(Deserialize)]
pub struct CopyProfileParams {
    source_profile_id: Uuid,
    new_profile_name: String,
    // Option um nur bestimmte Dateien zu kopieren
    include_files: Option<Vec<PathBuf>>,
}

// Export profile command parameters
#[derive(Deserialize)]
pub struct ExportProfileParams {
    profile_id: Uuid,
    output_path: Option<String>, // This will be ignored but kept for backward compatibility
    file_name: String,          // Base name without extension
    include_files: Option<Vec<PathBuf>>,
    open_folder: bool,         // Whether to open the exports folder after export
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
        source_standard_profile_id: None,
    };

    let id = state.profile_manager.create_profile(profile).await?;
    Ok(id)
}

#[tauri::command]
pub async fn launch_profile(id: Uuid) -> Result<(), CommandError> {
    let state = State::get().await?;
    
    // Try to get the regular profile
    let profile = match state.profile_manager.get_profile(id).await {
        Ok(profile) => {
            // Found existing profile - update last_played time
            let mut profile = profile;
            profile.last_played = Some(Utc::now());
            state
                .profile_manager
                .update_profile(id, profile.clone())
                .await?;
            profile
        },
        Err(_) => {
            // Profile not found - check if it's a standard version ID
            info!("Profile with ID {} not found, checking standard versions", id);
            let standard_versions = state.norisk_version_manager.get_config().await;
            
            // Find a standard profile with matching ID
            let standard_profile = standard_versions.profiles.iter()
                .find(|p| p.id == id)
                .ok_or_else(|| {
                    AppError::Other(format!("No profile or standard version found with ID {}", id))
                })?;
            
            // Convert standard profile to a temporary profile
            info!("Converting standard profile '{}' to a temporary profile", standard_profile.name);
            let converted_profile = crate::integrations::norisk_versions::convert_standard_to_user_profile(standard_profile)?;
            
            // Return the converted profile without saving it
            converted_profile
        }
    };

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

    let profile_id = profile.id;  // Store profile ID for later use
    let profile_clone = profile.clone();
    
    // Spawn the installation task and get the JoinHandle
    let handle = tokio::spawn(async move {
        let install_result = installer::install_minecraft_version(
            &version,
            &modloader.as_str(),
            &profile_clone,
            credentials,
        ).await;
        
        // Get state again within the spawn context
        if let Ok(state) = State::get().await {
            // Ensure we remove the launching process tracking when done
            state.process_manager.remove_launching_process(profile_id);
            
            match install_result {
                Ok(_) => info!(
                    "Successfully installed/launched Minecraft version {}",
                    version
                ),
                Err(e) => info!("Error installing/launching Minecraft: {}", e),
            }
        }
    });
    
    // Store the task handle for possible abortion
    state.process_manager.add_launching_process(profile_id, handle);

    Ok(())
}

/// Aborts an ongoing launch process for a profile.
/// This is useful to cancel a profile installation/launch that's taking too long.
#[tauri::command]
pub async fn abort_profile_launch(profile_id: Uuid) -> Result<(), CommandError> {
    info!("Attempting to abort launch process for profile ID: {}", profile_id);
    
    let state = State::get().await?;
    
    // Check if the profile has an active launching process
    if !state.process_manager.has_launching_process(profile_id) {
        info!("No active launch process found for profile ID: {}", profile_id);
        return Err(CommandError::from(AppError::Other(
            format!("No active launch process found for profile ID: {}", profile_id)
        )));
    }
    
    // Attempt to abort the process
    match state.process_manager.abort_launch_process(profile_id) {
        Ok(_) => {
            info!("Successfully aborted launch process for profile ID: {}", profile_id);
            Ok(())
        },
        Err(e) => {
            error!("Failed to abort launch process for profile ID {}: {}", profile_id, e);
            Err(CommandError::from(e))
        }
    }
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

/// Loads and returns the list of standard profiles from the local configuration file.
#[tauri::command]
pub async fn get_standard_profiles() -> Result<NoriskVersionsConfig, CommandError> {
    info!("Executing get_standard_profiles command");
    let state = State::get().await?;
    let config = state.norisk_version_manager.get_config().await;
    Ok(config)
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
    let profile = state.profile_manager.get_profile(profile_id).await?;
    Ok(state.profile_manager.list_custom_mods(&profile).await?)
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
            .add_filter("Modpack Files", &["mrpack", "noriskpack"])
            .set_title("Select Modpack File (.mrpack or .noriskpack)")
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

        // Check the file extension
        let file_extension = file_path_buf
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase());

        let new_profile_id = match file_extension.as_deref() {
            Some("mrpack") => {
                log::info!("File extension is .mrpack, proceeding with mrpack processing.");
                mrpack::import_mrpack_as_profile(file_path_buf).await?
            },
            Some("noriskpack") => {
                log::info!("File extension is .noriskpack, proceeding with noriskpack processing.");
                crate::integrations::norisk_packs::import_noriskpack_as_profile(file_path_buf).await?
            },
            _ => {
                log::error!("Selected file has an invalid extension: {:?}", file_path_buf);
                return Err(CommandError::from(AppError::Other(
                    "Invalid file type selected. Please select a .mrpack or .noriskpack file.".to_string(),
                )));
            }
        };

        // Get state to emit event
        let state = State::get().await?;
        // Emit event to trigger UI update for the newly created profile
        if let Err(e) = state
            .event_state
            .trigger_profile_update(new_profile_id)
            .await
        {
            log::error!(
                "Failed to emit TriggerProfileUpdate event for new profile {}: {}",
                new_profile_id,
                e
            );
        }

        Ok(())
    } else {
        log::info!("User cancelled the file import dialog.");
        Ok(())
    }
}

// Command to get all resourcepacks in a profile
#[tauri::command]
pub async fn get_local_resourcepacks(
    profile_id: Uuid,
) -> Result<Vec<resourcepack_utils::ResourcePackInfo>, CommandError> {
    log::info!(
        "Executing get_local_resourcepacks command for profile {}",
        profile_id
    );

    let state = State::get().await?;
    let profile = state.profile_manager.get_profile(profile_id).await?;

    // Use the utility function to get all resourcepacks
    let resourcepacks = resourcepack_utils::get_resourcepacks_for_profile(&profile)
        .await
        .map_err(|e| CommandError::from(e))?;

    Ok(resourcepacks)
}

// Command to get all shaderpacks in a profile
#[tauri::command]
pub async fn get_local_shaderpacks(
    profile_id: Uuid,
) -> Result<Vec<shaderpack_utils::ShaderPackInfo>, CommandError> {
    log::info!(
        "Executing get_local_shaderpacks command for profile {}",
        profile_id
    );

    let state = State::get().await?;
    let profile = state.profile_manager.get_profile(profile_id).await?;

    // Use the utility function to get all shaderpacks
    let shaderpacks = shaderpack_utils::get_shaderpacks_for_profile(&profile)
        .await
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
    info!(
        "Executing add_modrinth_content_to_profile for profile {}",
        profile_id
    );

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

/// Command to get the directory structure of a profile
#[tauri::command]
pub async fn get_profile_directory_structure(
    profile_id: Uuid,
) -> Result<path_utils::FileNode, CommandError> {
    log::info!("Executing get_profile_directory_structure command for profile {}", profile_id);

    let state = State::get().await?;
    
    // Profil abrufen - versuche reguläres Profil oder Standard-Version
    let profile = match state.profile_manager.get_profile(profile_id).await {
        Ok(profile) => profile,
        Err(_) => {
            // Profil nicht gefunden - prüfe ob es eine Standard-Version ID ist
            log::info!("Profile with ID {} not found, checking standard versions", profile_id);
            let standard_versions = state.norisk_version_manager.get_config().await;
            
            // Finde ein Standard-Profil mit passender ID
            let standard_profile = standard_versions.profiles.iter()
                .find(|p| p.id == profile_id)
                .ok_or_else(|| {
                    AppError::Other(format!("No profile or standard version found with ID {}", profile_id))
                })?;
            
            // Konvertiere Standard-Profil zu einem temporären Profil
            log::info!("Converting standard profile '{}' to a user profile for directory structure", standard_profile.name);
            norisk_versions::convert_standard_to_user_profile(standard_profile)?
        }
    };
    
    // Calculate the full profile path
    let profile_path = state.profile_manager
        .calculate_instance_path_for_profile(&profile)?;
    
    // Get the directory structure using path_utils
    let structure = path_utils::get_directory_structure(&profile_path, false)
        .await
        .map_err(|e| CommandError::from(e))?;
    
    Ok(structure)
}

/// Kopiert ein bestehendes Profil und erstellt ein neues mit den gleichen Eigenschaften,
/// aber kopiert nur die angegebenen Dateien wenn include_files angegeben ist.
#[tauri::command]
pub async fn copy_profile(params: CopyProfileParams) -> Result<Uuid, CommandError> {
    info!("Executing copy_profile command from profile {}", params.source_profile_id);
    
    let state = State::get().await?;
    
    // 1. Quellprofil abrufen - versuche reguläres Profil oder Standard-Version
    let source_profile = match state.profile_manager.get_profile(params.source_profile_id).await {
        Ok(profile) => profile,
        Err(_) => {
            // Profil nicht gefunden - prüfe ob es eine Standard-Version ID ist
            info!("Profile with ID {} not found, checking standard versions", params.source_profile_id);
            let standard_versions = state.norisk_version_manager.get_config().await;
            
            // Finde ein Standard-Profil mit passender ID
            let standard_profile = standard_versions.profiles.iter()
                .find(|p| p.id == params.source_profile_id)
                .ok_or_else(|| {
                    AppError::Other(format!("No profile or standard version found with ID {}", params.source_profile_id))
                })?;
            
            // Konvertiere Standard-Profil zu einem temporären Profil
            info!("Converting standard profile '{}' to a user profile for copying", standard_profile.name);
            norisk_versions::convert_standard_to_user_profile(standard_profile)?
        }
    };
    
    // 2. Basis-Pfad für Profile bestimmen
    let base_profiles_dir = default_profile_path();
    TokioFs::create_dir_all(&base_profiles_dir)
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;
    
    // 3. Gewünschten Segmentnamen für das neue Profil bereinigen
    let sanitized_base_name = sanitize(&params.new_profile_name);
    if sanitized_base_name.is_empty() {
        return Err(CommandError::from(AppError::Other(
            "Profile name is invalid after sanitization.".to_string(),
        )));
    }
    
    // 4. Eindeutigen Segmentnamen finden
    let unique_segment = find_unique_profile_segment(&base_profiles_dir, &sanitized_base_name).await?;
    info!("Unique segment for copied profile: {}", unique_segment);
    
    // 5. Erstelle ein neues Profil basierend auf dem Quellprofil
    let new_profile = Profile {
        id: Uuid::new_v4(),
        name: params.new_profile_name.clone(),
        path: unique_segment.clone(), // Verwende den eindeutigen Pfad
        game_version: source_profile.game_version.clone(),
        loader: source_profile.loader.clone(),
        loader_version: source_profile.loader_version.clone(),
        created: Utc::now(),
        last_played: None,
        settings: source_profile.settings.clone(),
        state: ProfileState::NotInstalled, // Neues Profil ist noch nicht installiert
        mods: Vec::new(), // Mods werden erst nach dem Kopieren aktualisiert
        selected_norisk_pack_id: source_profile.selected_norisk_pack_id.clone(),
        disabled_norisk_mods_detailed: source_profile.disabled_norisk_mods_detailed.clone(),
        source_standard_profile_id: source_profile.source_standard_profile_id,
    };
    
    // 6. Erstelle das neue Profilverzeichnis
    let new_profile_path = base_profiles_dir.join(&unique_segment);
    TokioFs::create_dir_all(&new_profile_path)
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;
    
    // 7. Berechne die vollständigen Pfade für Quell- und Zielverzeichnisse
    let source_full_path = base_profiles_dir.join(&source_profile.path);
    
    // 8. Kopiere die Dateien basierend auf den Parametern
    let files_copied = if let Some(include_files) = &params.include_files {
        if !include_files.is_empty() {
            // Wenn eine nicht-leere Include-Liste angegeben wurde, verwende die neue Funktion
            info!("Copying only specified files ({} paths) to new profile {}", 
                 include_files.len(), new_profile.id);
                 
            // Die neue Funktion kümmert sich um alles in einem Schritt
            path_utils::copy_profile_with_includes(
                &source_full_path,
                &new_profile_path,
                include_files
            ).await?
        } else {
            // Leere include_files bedeutet: kopiere nichts
            info!("Empty include_files list, not copying any files to new profile {}", new_profile.id);
            0
        }
    } else {
        info!("No include_files specified, copying no files to new profile {}", new_profile.id);
        0
    };
    
    info!("Copied {} files to new profile {}", files_copied, new_profile.id);
    
    // 9. Speichere das neue Profil in der Datenbank
    let new_profile_id = state.profile_manager.create_profile(new_profile).await?;
    
    // 10. Event auslösen, um das UI zu aktualisieren
    if let Err(e) = state.event_state.trigger_profile_update(new_profile_id).await {
        log::error!(
            "Failed to emit TriggerProfileUpdate event for profile {}: {}",
            new_profile_id,
            e
        );
    }
    
    Ok(new_profile_id)
}

/// Exports a profile to a .noriskpack file format with a fixed export directory
#[tauri::command]
pub async fn export_profile(app_handle: tauri::AppHandle, params: ExportProfileParams) -> Result<String, CommandError> {
    info!("Executing export_profile command for profile {}", params.profile_id);
    
    // Ensure the exports directory exists
    let exports_dir = LAUNCHER_DIRECTORY.root_dir().join("exports");
    TokioFs::create_dir_all(&exports_dir)
        .await
        .map_err(|e| CommandError::from(AppError::Io(e)))?;
    
    // Sanitize the filename and add .noriskpack extension
    let sanitized_name = sanitize(&params.file_name);
    if sanitized_name.is_empty() {
        return Err(CommandError::from(AppError::Other(
            "Export filename is invalid after sanitization.".to_string(),
        )));
    }
    
    // Generate complete filename with extension
    let noriskpack_filename = format!("{}.noriskpack", sanitized_name);
    
    // Create full export path
    let export_path = exports_dir.join(&noriskpack_filename);
    
    info!("Exporting profile to {}", export_path.display());
    
    // Perform the export
    let result_path = profile_utils::export_profile_to_noriskpack(
        params.profile_id,
        Some(export_path.clone()),
        params.include_files,
    ).await?;
    
    // Open the export directory if requested
    if params.open_folder {
        info!("Opening export directory: {}", exports_dir.display());
        if let Err(e) = app_handle.opener().open_path(exports_dir.to_string_lossy(), None::<&str>) {
            info!("Failed to open export directory: {}", e);
            // Don't fail the command if directory opening fails
        }
    }
    
    Ok(result_path.to_string_lossy().to_string())
}

/// Checks if a profile is currently being launched.
/// Returns true if there's an active launch process for the given profile ID.
#[tauri::command]
pub async fn is_profile_launching(profile_id: Uuid) -> Result<bool, CommandError> {
    let state = State::get().await?;
    Ok(state.process_manager.has_launching_process(profile_id))
}

