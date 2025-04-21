use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::integrations::norisk_packs::NoriskModpacksConfig;
use crate::minecraft::api::fabric_api::FabricApi;
use crate::minecraft::api::mc_api::MinecraftApiService;
use crate::minecraft::downloads::fabric_libraries_download::FabricLibrariesDownloadService;
use crate::minecraft::downloads::java_download::JavaDownloadService;
use crate::minecraft::downloads::mc_assets_download::MinecraftAssetsDownloadService;
use crate::minecraft::downloads::mc_client_download::MinecraftClientDownloadService;
use crate::minecraft::downloads::mc_libraries_download::MinecraftLibrariesDownloadService;
use crate::minecraft::downloads::mc_natives_download::MinecraftNativesDownloadService;
use crate::minecraft::downloads::ModDownloadService;
use crate::minecraft::downloads::NoriskPackDownloadService;
use crate::minecraft::downloads::{ForgeInstallerDownloadService, ForgeLibrariesDownload};
use crate::minecraft::dto::JavaDistribution;
use crate::minecraft::launch::forge_arguments::ForgeArguments;
use crate::minecraft::{ForgeApi, ForgePatcher, MinecraftLaunchParameters, MinecraftLauncher};
use crate::state::event_state::{EventPayload, EventType};
use crate::state::profile_state::{ModLoader, Profile};
use crate::state::state_manager::State;
use log::{error, info};
use uuid::Uuid;

use super::minecraft_auth::Credentials;

pub async fn install_minecraft_version(
    version_id: &str,
    modloader_str: &str,
    profile: &Profile,
    credentials: Option<Credentials>,
) -> Result<()> {
    // Convert string modloader to ModLoader enum
    let modloader_enum = match modloader_str {
        "vanilla" => ModLoader::Vanilla,
        "fabric" => ModLoader::Fabric,
        "forge" => ModLoader::Forge,
        "neoforge" => ModLoader::NeoForge,
        "quilt" => ModLoader::Quilt,
        _ => {
            return Err(AppError::Unknown(format!(
                "Unbekannter Modloader: {}",
                modloader_str
            )))
        }
    };

    // Get version manifest and find the specific version
    info!(
        "Installing Minecraft version: {} with modloader: {:?}",
        version_id, modloader_enum
    );

    let api_service = MinecraftApiService::new();
    let manifest = api_service.get_version_manifest().await?;
    let version = manifest
        .versions
        .iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| AppError::VersionNotFound(format!("Version {} not found", version_id)))?;

    // Get version metadata
    let piston_meta = api_service.get_piston_meta(&version.url).await?;
    piston_meta.display_info();

    // Get Java version from Minecraft version manifest
    let java_version = piston_meta.java_version.major_version as u32;
    info!("\nChecking Java {} for Minecraft...", java_version);

    // Emit Java installation event
    let event_id = Uuid::new_v4();
    let state = State::get().await?;
    state
        .emit_event(EventPayload {
            event_id,
            event_type: EventType::InstallingJava,
            target_id: Some(profile.id),
            message: format!("Java {} wird installiert...", java_version),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    // Download and setup Java
    let java_service = JavaDownloadService::new();
    let java_path = java_service
        .get_or_download_java(java_version, &JavaDistribution::Temurin)
        .await?;
    info!("Java installation path: {:?}", java_path);

    // Update progress to 100%
    state
        .emit_event(EventPayload {
            event_id,
            event_type: EventType::InstallingJava,
            target_id: Some(profile.id),
            message: format!("Java {} Installation abgeschlossen!", java_version),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // Create game directory
    let game_directory = state.profile_manager.get_profile_instance_path(profile.id).await?;
    std::fs::create_dir_all(&game_directory)?;

    // Emit libraries download event
    let libraries_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: libraries_event_id,
            event_type: EventType::DownloadingLibraries,
            target_id: Some(profile.id),
            message: "Libraries werden heruntergeladen...".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    // Download all required files
    info!("\nDownloading libraries...");
    let libraries_service = MinecraftLibrariesDownloadService::new();
    libraries_service
        .download_libraries(&piston_meta.libraries)
        .await?;
    info!("Library download completed!");

    state
        .emit_event(EventPayload {
            event_id: libraries_event_id,
            event_type: EventType::DownloadingLibraries,
            target_id: Some(profile.id),
            message: "Libraries Download abgeschlossen!".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // Emit natives extraction event
    let natives_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: natives_event_id,
            event_type: EventType::ExtractingNatives,
            target_id: Some(profile.id),
            message: "Natives werden extrahiert...".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    info!("\nExtracting natives...");
    let natives_service = MinecraftNativesDownloadService::new();
    natives_service
        .extract_natives(&piston_meta.libraries, version_id)
        .await?;
    info!("Native extraction completed!");

    state
        .emit_event(EventPayload {
            event_id: natives_event_id,
            event_type: EventType::ExtractingNatives,
            target_id: Some(profile.id),
            message: "Natives Extraktion abgeschlossen!".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // Emit assets download event
    let assets_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: assets_event_id,
            event_type: EventType::DownloadingAssets,
            target_id: Some(profile.id),
            message: "Assets werden heruntergeladen...".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    info!("\nDownloading assets...");
    let assets_service = MinecraftAssetsDownloadService::new();
    assets_service
        .download_assets(&piston_meta.asset_index)
        .await?;
    info!("Asset download completed!");

    state
        .emit_event(EventPayload {
            event_id: assets_event_id,
            event_type: EventType::DownloadingAssets,
            target_id: Some(profile.id),
            message: "Assets Download abgeschlossen!".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // Emit client download event
    let client_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: client_event_id,
            event_type: EventType::DownloadingClient,
            target_id: Some(profile.id),
            message: "Minecraft Client wird heruntergeladen...".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    info!("\nDownloading Minecraft client...");
    let client_service = MinecraftClientDownloadService::new();
    client_service
        .download_client(&piston_meta.downloads.client, &piston_meta.id)
        .await?;
    info!("Client download completed!");

    state
        .emit_event(EventPayload {
            event_id: client_event_id,
            event_type: EventType::DownloadingClient,
            target_id: Some(profile.id),
            message: "Minecraft Client Download abgeschlossen!".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // Create and use Minecraft launcher
    let launcher = MinecraftLauncher::new(java_path.clone(), game_directory.clone(), credentials);

    info!("\nPreparing launch parameters...");
    let mut launch_params = MinecraftLaunchParameters::new(profile.id, profile.settings.memory.max)
        .with_old_minecraft_arguments(piston_meta.minecraft_arguments.clone());

    if modloader_enum == ModLoader::Fabric {
        // Emit Fabric installation event
        let fabric_event_id = Uuid::new_v4();
        state
            .emit_event(EventPayload {
                event_id: fabric_event_id,
                event_type: EventType::InstallingFabric,
                target_id: Some(profile.id),
                message: "Fabric wird installiert...".to_string(),
                progress: Some(0.0),
                error: None,
            })
            .await?;

        info!("\nInstalling Fabric...");
        let fabric_api = FabricApi::new();
        let fabric_libraries_download = FabricLibrariesDownloadService::new();

        // --- Determine Fabric Version --- 
        let fabric_version = match &profile.loader_version {
            Some(specific_version_str) if !specific_version_str.is_empty() => {
                info!("Attempting to find specific Fabric version: {}", specific_version_str);
                let all_versions = fabric_api.get_loader_versions(version_id).await?;
                
                // Strip " (stable)" suffix if present for comparison
                let target_version = specific_version_str.trim_end_matches(" (stable)").trim();

                match all_versions.into_iter().find(|v| v.loader.version == target_version) {
                    Some(found_version) => {
                        info!("Found specified Fabric version: {}", specific_version_str);
                        found_version
                    }
                    None => {
                        log::warn!(
                            "Specified Fabric version '{}' not found for MC {}. Falling back to latest stable.",
                            specific_version_str, version_id
                        );
                        // Fallback to latest stable if specific version not found
                        fabric_api.get_latest_stable_version(version_id).await?
                    }
                }
            }
            _ => {
                // Fallback to latest stable if no specific version is set in the profile
                info!("No specific Fabric version set in profile, using latest stable.");
                fabric_api.get_latest_stable_version(version_id).await?
            }
        };
        // --- End Determine Fabric Version ---

        info!("Using Fabric version: {} (Stable: {})", fabric_version.loader.version, fabric_version.loader.stable);

        fabric_libraries_download
            .download_fabric_libraries(&fabric_version) // Use the determined version
            .await?;
        info!("Fabric installation completed!");

        state
            .emit_event(EventPayload {
                event_id: fabric_event_id,
                event_type: EventType::InstallingFabric,
                target_id: Some(profile.id),
                message: "Fabric Installation abgeschlossen!".to_string(),
                progress: Some(1.0),
                error: None,
            })
            .await?;

        // Collect library paths for the determined version
        let libraries = fabric_libraries_download
            .get_library_paths(&fabric_version)
            .await?;

        launch_params = launch_params
            .with_main_class(&fabric_version.launcher_meta.main_class.get_client())
            .with_additional_libraries(libraries);
    } else if modloader_enum == ModLoader::Forge {
        // Emit Forge installation event
        let forge_event_id = Uuid::new_v4();
        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Forge wird installiert...".to_string(),
                progress: Some(0.0),
                error: None,
            })
            .await?;

        info!("\nInstalling Forge...");

        // Initialize services
        let forge_api = ForgeApi::new();
        let forge_libraries_download = ForgeLibrariesDownload::new();
        let forge_installer_download = ForgeInstallerDownloadService::new();

        // Get all Forge versions metadata
        let forge_metadata = forge_api.get_all_versions().await?;
        // Get versions compatible with the current Minecraft version
        let compatible_versions = forge_metadata.get_versions_for_minecraft(version_id);

        if compatible_versions.is_empty() {
            return Err(AppError::VersionNotFound(format!(
                "No Forge versions found for Minecraft {}",
                version_id
            )));
        }

        // --- Determine Forge Version --- 
        let target_forge_version = match &profile.loader_version {
            Some(specific_version_str) if !specific_version_str.is_empty() => {
                info!("Attempting to find specific Forge version: {}", specific_version_str);
                
                // Check if the specific version exists in the compatible list
                if compatible_versions.contains(specific_version_str) {
                    info!("Found specified Forge version: {}", specific_version_str);
                    specific_version_str.clone() // Clone the string to own it
                } else {
                    log::warn!(
                        "Specified Forge version '{}' not found or incompatible with MC {}. Falling back to latest.",
                        specific_version_str, version_id
                    );
                    // Fallback to the latest compatible version (first in the list from get_versions_for_minecraft)
                    compatible_versions.first().unwrap().clone() // Unsafe unwrap okay due to is_empty check above
                }
            }
            _ => {
                // Fallback to latest compatible if no specific version is set
                info!("No specific Forge version set in profile, using latest for MC {}.", version_id);
                 compatible_versions.first().unwrap().clone() // Unsafe unwrap okay due to is_empty check above
            }
        };
        // --- End Determine Forge Version ---

        info!("Using Forge version: {}", target_forge_version);

        // Emit Forge version found event (using the determined version)
        state.emit_event(EventPayload {
            event_id: forge_event_id, 
            event_type: EventType::InstallingForge, 
            target_id: Some(profile.id), 
            message: format!("Forge Version {} wird verwendet", target_forge_version), 
            progress: Some(0.1), 
            error: None 
        }).await?;

        // Download and extract Forge installer (using the determined version)
        state.emit_event(EventPayload {
            event_id: forge_event_id,
            event_type: EventType::InstallingForge,
            target_id: Some(profile.id),
            message: "Forge Installer wird heruntergeladen...".to_string(),
            progress: Some(0.2),
            error: None,
        }).await?;

        forge_installer_download
            .download_installer(&target_forge_version)
            .await?;

        state.emit_event(EventPayload {
            event_id: forge_event_id,
            event_type: EventType::InstallingForge,
            target_id: Some(profile.id),
            message: "Forge Installer wird extrahiert...".to_string(),
            progress: Some(0.3),
            error: None,
        }).await?;

        let forge_version = forge_installer_download.extract_version_json(&target_forge_version).await?;
        let profile_json = forge_installer_download.extract_install_profile(&target_forge_version).await?;
        forge_installer_download.extract_data_folder(&target_forge_version).await?;
        forge_installer_download.extract_maven_folder(&target_forge_version).await?;
        forge_installer_download.extract_jars(&target_forge_version).await?;

        state.emit_event(EventPayload {
            event_id: forge_event_id,
            event_type: EventType::InstallingForge,
            target_id: Some(profile.id),
            message: "Forge Libraries werden heruntergeladen...".to_string(),
            progress: Some(0.4),
            error: None,
        }).await?;

        // Download Forge libraries (still uses forge_version DTO derived from the installer)
        forge_libraries_download
            .download_libraries(&forge_version)
            .await?;
        let libraries = forge_libraries_download
            .get_library_paths(&forge_version, profile_json.is_none())
            .await?;

        info!("Forge Libraries: {:?}", libraries);

        // Setup launch parameters (using determined target_forge_version for JVM args)
        launch_params = launch_params
            .with_main_class(&forge_version.main_class)
            .with_additional_libraries(libraries)
            .with_additional_jvm_args(ForgeArguments::get_jvm_arguments(
                &forge_version,
                &LAUNCHER_DIRECTORY.meta_dir().join("libraries"),
                &target_forge_version, // Use determined version here
            ))
            .with_additional_game_args(ForgeArguments::get_game_arguments(&forge_version))
            .with_old_minecraft_arguments(forge_version.minecraft_arguments.clone());

        // Use determined target_forge_version for client path and installer path
        let custom_client_path = forge_installer_download.get_client_path(&target_forge_version);
        let installer_path = forge_installer_download.get_installer_path(&target_forge_version);

        if let Some(forge_profile) = profile_json {
            state.emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Forge Installer Libraries werden heruntergeladen...".to_string(),
                progress: Some(0.6),
                error: None,
            }).await?;

            forge_libraries_download
                .download_installer_libraries(&forge_profile)
                .await?;

            state.emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Forge wird gepatcht...".to_string(),
                progress: Some(0.7),
                error: None,
            }).await?;

            let forge_patcher = ForgePatcher::new(java_path.clone(), version_id);
            // Use determined installer_path
            forge_patcher
                .with_event_id(forge_event_id)
                .with_profile_id(profile.id)
                .apply_processors(&forge_profile, version_id, true, &installer_path)
                .await?;

            // Use determined custom_client_path
            launch_params = launch_params.with_custom_client_jar(custom_client_path);

            if piston_meta.id == "1.12.2" {
                launch_params = launch_params.with_force_include_minecraft_jar(true);
            }
        } else {
            // Restore full event payload for legacy library download
            state.emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Legacy Forge Libraries werden heruntergeladen...".to_string(),
                progress: Some(0.8),
                error: None,
            }).await?;

            forge_libraries_download
                .download_legacy_libraries(&forge_version)
                .await?;
        }

        info!("Forge installation completed!");

        state.emit_event(EventPayload {
            event_id: forge_event_id,
            event_type: EventType::InstallingForge,
            target_id: Some(profile.id),
            message: "Forge Installation abgeschlossen!".to_string(),
            progress: Some(1.0),
            error: None,
        }).await?;

    } else {
        launch_params = launch_params.with_main_class(&piston_meta.main_class);
    }

    // --- Fetch Norisk Config Once if a pack is selected ---
    let loaded_norisk_config: Option<NoriskModpacksConfig> =
        if let Some(pack_id) = &profile.selected_norisk_pack_id {
            info!(
                "Fetching Norisk config because pack '{}' is selected.",
                pack_id
            );
            // No need to clone state here, it's still valid in this scope
            Some(state.norisk_pack_manager.get_config().await)
        } else {
            None
        };

    // --- Step: Ensure profile-defined mods are downloaded/verified in cache ---
    let mods_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: mods_event_id,
            event_type: EventType::DownloadingMods,
            target_id: Some(profile.id),
            message: "Downloading/Checking Profile Mods... (Phase 1)".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    info!(
        "Ensuring profile-defined mods for profile '{}' are downloaded to cache...",
        profile.name
    );
    let mod_downloader_service = ModDownloadService::new();
    mod_downloader_service
        .download_mods_to_cache(&profile)
        .await?;
    info!(
        "Profile mod cache check/download completed successfully for profile '{}'",
        profile.name
    );
    state
        .emit_event(EventPayload {
            event_id: mods_event_id,
            event_type: EventType::DownloadingMods,
            target_id: Some(profile.id),
            message: "Profile Mods downloaded successfully! (Phase 1)".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // --- Step: Download mods from selected Norisk Pack (if any) ---
    if let Some(selected_pack_id) = &profile.selected_norisk_pack_id {
        // Use the already loaded config
        if let Some(config) = loaded_norisk_config.as_ref() {
            let norisk_mods_event_id = Uuid::new_v4();
            state
                .emit_event(EventPayload {
                    event_id: norisk_mods_event_id,
                    event_type: EventType::DownloadingMods,
                    target_id: Some(profile.id),
                    message: format!(
                        "Downloading Norisk Pack '{}' Mods... (Phase 2)",
                        selected_pack_id
                    ),
                    progress: Some(0.0),
                    error: None,
                })
                .await?;

            info!(
                "Downloading mods for selected Norisk Pack '{}'...",
                selected_pack_id
            );

            let norisk_downloader_service = NoriskPackDownloadService::new();
            let loader_str = modloader_enum.as_str();

            match norisk_downloader_service
                .download_pack_mods_to_cache(
                    config, // Pass the reference to the loaded config
                    selected_pack_id,
                    version_id,
                    loader_str,
                )
                .await
            {
                Ok(_) => {
                    info!(
                        "Norisk Pack '{}' mods download completed successfully.",
                        selected_pack_id
                    );
                    state
                        .emit_event(EventPayload {
                            event_id: norisk_mods_event_id,
                            event_type: EventType::DownloadingMods,
                            target_id: Some(profile.id),
                            message: format!(
                                "Norisk Pack '{}' Mods downloaded successfully! (Phase 2)",
                                selected_pack_id
                            ),
                            progress: Some(1.0),
                            error: None,
                        })
                        .await?;
                }
                Err(e) => {
                    error!(
                        "Failed to download Norisk Pack '{}' mods: {}",
                        selected_pack_id, e
                    );
                    state
                        .emit_event(EventPayload {
                            event_id: norisk_mods_event_id,
                            event_type: EventType::DownloadingMods,
                            target_id: Some(profile.id),
                            message: format!(
                                "Error downloading Norisk Pack '{}' mods!",
                                selected_pack_id
                            ),
                            progress: Some(1.0),
                            error: Some(e.to_string()),
                        })
                        .await?;
                }
            }
        } else {
            // Should not happen if selected_pack_id is Some, but handle defensively
            error!(
                "Norisk config was expected but not loaded for pack ID: {}",
                selected_pack_id
            );
        }
    } else {
        info!(
            "No Norisk Pack selected for profile '{}', skipping pack download.",
            profile.name
        );
    }

    // --- Step: Resolve final mod list for syncing ---
    let resolve_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: resolve_event_id,
            event_type: EventType::SyncingMods, // Reuse SyncingMods or add ResolvingMods
            target_id: Some(profile.id),
            message: "Resolving final mod list...".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    let mod_cache_dir = LAUNCHER_DIRECTORY.meta_dir().join("mod_cache");

    // ---> NEW: Get custom mods for this profile <---
    info!("Listing custom mods for profile '{}'...", profile.name);
    let custom_mod_infos = state.profile_manager.list_custom_mods(profile.id).await?;
    info!("Found {} custom mods for profile '{}'", custom_mod_infos.len(), profile.name);
    // ---> END NEW <--- 

    // Call the resolver function using the already loaded config (or None)
    let target_mods = crate::minecraft::downloads::mod_resolver::resolve_target_mods(
        profile,
        loaded_norisk_config.as_ref(), // Pass the reference directly
        Some(&custom_mod_infos), // ---> NEW: Pass custom mods <---
        version_id,
        modloader_enum.as_str(),
        &mod_cache_dir,
    )
    .await?;

    state
        .emit_event(EventPayload {
            event_id: resolve_event_id,
            event_type: EventType::SyncingMods,
            target_id: Some(profile.id),
            message: format!("Resolved {} mods for sync.", target_mods.len()),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // --- Step: Sync mods from cache to profile directory ---
    let sync_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: sync_event_id,
            event_type: EventType::SyncingMods,
            target_id: Some(profile.id),
            message: "Syncing mods to profile directory... (Phase 3)".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    info!(
        "Syncing mods from cache to profile directory for '{}'...",
        profile.name
    );
    // Pass the resolved target_mods list to the sync function
    mod_downloader_service
        .sync_mods_to_profile(&target_mods, &game_directory)
        .await?;

    info!("Mod sync completed for profile '{}'", profile.name);
    state
        .emit_event(EventPayload {
            event_id: sync_event_id,
            event_type: EventType::SyncingMods,
            target_id: Some(profile.id),
            message: "Mod sync complete! (Phase 3)".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    // --- Launch Minecraft ---
    // Emit launch event
    let launch_event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id: launch_event_id,
            event_type: EventType::LaunchingMinecraft,
            target_id: Some(profile.id),
            message: "Minecraft wird gestartet...".to_string(),
            progress: Some(0.0),
            error: None,
        })
        .await?;

    launcher.launch(&piston_meta, launch_params).await?;

    state
        .emit_event(EventPayload {
            event_id: launch_event_id,
            event_type: EventType::LaunchingMinecraft,
            target_id: Some(profile.id),
            message: "Minecraft wurde gestartet!".to_string(),
            progress: Some(1.0),
            error: None,
        })
        .await?;

    Ok(())
}
