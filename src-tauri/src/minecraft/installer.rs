use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::integrations::norisk_packs::NoriskModpacksConfig;
use crate::minecraft::api::fabric_api::FabricApi;
use crate::minecraft::api::mc_api::MinecraftApiService;
use crate::minecraft::api::quilt_api::QuiltApi;
use crate::minecraft::downloads::fabric_libraries_download::FabricLibrariesDownloadService;
use crate::minecraft::downloads::java_download::JavaDownloadService;
use crate::minecraft::downloads::logging_config_download::MinecraftLoggingDownloadService;
use crate::minecraft::downloads::mc_assets_download::MinecraftAssetsDownloadService;
use crate::minecraft::downloads::mc_client_download::MinecraftClientDownloadService;
use crate::minecraft::downloads::mc_libraries_download::MinecraftLibrariesDownloadService;
use crate::minecraft::downloads::mc_natives_download::MinecraftNativesDownloadService;
use crate::minecraft::downloads::quilt_libraries_download::QuiltLibrariesDownloadService;
use crate::minecraft::downloads::ModDownloadService;
use crate::minecraft::downloads::NoriskPackDownloadService;
use crate::minecraft::downloads::{ForgeInstallerDownloadService, ForgeLibrariesDownload};
use crate::minecraft::dto::JavaDistribution;
use crate::minecraft::launch::forge_arguments::ForgeArguments;
use crate::minecraft::launch::neo_forge_arguments::NeoForgeArguments;
use crate::minecraft::{
    ForgeApi, ForgePatcher, MinecraftLaunchParameters, MinecraftLauncher, NeoForgePatcher,
};
use crate::state::event_state::{EventPayload, EventType};
use crate::state::profile_state::{ModLoader, Profile};
use crate::state::state_manager::State;
use log::{error, info};
use uuid::Uuid;

use super::minecraft_auth::Credentials;
use super::modloader::ModloaderFactory;

async fn emit_progress_event(
    state: &State,
    event_type: EventType,
    profile_id: Uuid,
    message: &str,
    progress: f64,
    error: Option<String>,
) -> Result<Uuid> {
    let event_id = Uuid::new_v4();
    state
        .emit_event(EventPayload {
            event_id,
            event_type,
            target_id: Some(profile_id),
            message: message.to_string(),
            progress: Some(progress),
            error,
        })
        .await?;
    Ok(event_id)
}

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
    let state = State::get().await?;
    let event_id = emit_progress_event(
        &state,
        EventType::InstallingJava,
        profile.id,
        &format!("Java {} wird installiert...", java_version),
        0.0,
        None,
    )
    .await?;

    // Download and setup Java
    let java_service = JavaDownloadService::new();
    let java_path = java_service
        .get_or_download_java(
            java_version,
            &JavaDistribution::Zulu,
            Some(&piston_meta.java_version.component),
        )
        .await?;
    info!("Java installation path: {:?}", java_path);

    // Update progress to 100%
    emit_progress_event(
        &state,
        EventType::InstallingJava,
        profile.id,
        &format!("Java {} Installation abgeschlossen!", java_version),
        1.0,
        None,
    )
    .await?;

    // Create game directory
    let game_directory = state
        .profile_manager
        .calculate_instance_path_for_profile(profile)?;
    std::fs::create_dir_all(&game_directory)?;

    // Emit libraries download event
    let libraries_event_id = emit_progress_event(
        &state,
        EventType::DownloadingLibraries,
        profile.id,
        "Libraries werden heruntergeladen...",
        0.0,
        None,
    )
    .await?;

    // Download all required files
    info!("\nDownloading libraries...");
    let libraries_service = MinecraftLibrariesDownloadService::new();
    libraries_service
        .download_libraries(&piston_meta.libraries)
        .await?;
    info!("Library download completed!");

    emit_progress_event(
        &state,
        EventType::DownloadingLibraries,
        profile.id,
        "Libraries Download abgeschlossen!",
        1.0,
        None,
    )
    .await?;

    // Emit natives extraction event
    let natives_event_id = emit_progress_event(
        &state,
        EventType::ExtractingNatives,
        profile.id,
        "Natives werden extrahiert...",
        0.0,
        None,
    )
    .await?;

    info!("\nExtracting natives...");
    let natives_service = MinecraftNativesDownloadService::new();
    natives_service
        .extract_natives(&piston_meta.libraries, version_id)
        .await?;
    info!("Native extraction completed!");

    emit_progress_event(
        &state,
        EventType::ExtractingNatives,
        profile.id,
        "Natives Extraktion abgeschlossen!",
        1.0,
        None,
    )
    .await?;

    // Emit assets download event
    let assets_event_id = emit_progress_event(
        &state,
        EventType::DownloadingAssets,
        profile.id,
        "Assets werden heruntergeladen...",
        0.0,
        None,
    )
    .await?;

    info!("\nDownloading assets...");
    let assets_service = MinecraftAssetsDownloadService::new();
    assets_service
        .download_assets(&piston_meta.asset_index)
        .await?;
    info!("Asset download completed!");

    emit_progress_event(
        &state,
        EventType::DownloadingAssets,
        profile.id,
        "Assets Download abgeschlossen!",
        1.0,
        None,
    )
    .await?;

    // Emit client download event
    let client_event_id = emit_progress_event(
        &state,
        EventType::DownloadingClient,
        profile.id,
        "Minecraft Client wird heruntergeladen...",
        0.0,
        None,
    )
    .await?;

    info!("\nDownloading Minecraft client...");
    let client_service = MinecraftClientDownloadService::new();
    client_service
        .download_client(&piston_meta.downloads.client, &piston_meta.id)
        .await?;
    info!("Client download completed!");

    emit_progress_event(
        &state,
        EventType::DownloadingClient,
        profile.id,
        "Minecraft Client Download abgeschlossen!",
        1.0,
        None,
    )
    .await?;

    // Create and use Minecraft launcher
    let launcher = MinecraftLauncher::new(java_path.clone(), game_directory.clone(), credentials);

    info!("\nPreparing launch parameters...");
    let mut launch_params = MinecraftLaunchParameters::new(profile.id, profile.settings.memory.max)
        .with_old_minecraft_arguments(piston_meta.minecraft_arguments.clone());

    // Install modloader using the factory
    if modloader_enum != ModLoader::Vanilla {
        let modloader_installer =
            ModloaderFactory::create_installer(&modloader_enum, java_path.clone());
        let modloader_result = modloader_installer.install(version_id, profile).await?;

        // Apply modloader specific parameters to launch parameters
        if let Some(main_class) = modloader_result.main_class {
            launch_params = launch_params.with_main_class(&main_class);
        } else {
            launch_params = launch_params.with_main_class(&piston_meta.main_class);
        }

        if !modloader_result.libraries.is_empty() {
            launch_params = launch_params.with_additional_libraries(modloader_result.libraries);
        }

        if let Some(jvm_args) = modloader_result.jvm_args {
            launch_params = launch_params.with_additional_jvm_args(jvm_args);
        }

        if let Some(game_args) = modloader_result.game_args {
            launch_params = launch_params.with_additional_game_args(game_args);
        }

        if let Some(minecraft_arguments) = modloader_result.minecraft_arguments {
            launch_params = launch_params.with_old_minecraft_arguments(Some(minecraft_arguments));
        }

        if let Some(custom_client_path) = modloader_result.custom_client_path {
            launch_params = launch_params.with_custom_client_jar(custom_client_path);
        }

        if modloader_result.force_include_minecraft_jar {
            launch_params = launch_params.with_force_include_minecraft_jar(true);
        }
    } else {
        // Vanilla main class
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
    let mods_event_id = emit_progress_event(
        &state,
        EventType::DownloadingMods,
        profile.id,
        "Downloading/Checking Profile Mods... (Phase 1)",
        0.0,
        None,
    )
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

    emit_progress_event(
        &state,
        EventType::DownloadingMods,
        profile.id,
        "Profile Mods downloaded successfully! (Phase 1)",
        1.0,
        None,
    )
    .await?;

    // --- Step: Download mods from selected Norisk Pack (if any) ---
    if let Some(selected_pack_id) = &profile.selected_norisk_pack_id {
        // Use the already loaded config
        if let Some(config) = loaded_norisk_config.as_ref() {
            let norisk_mods_event_id = emit_progress_event(
                &state,
                EventType::DownloadingMods,
                profile.id,
                &format!(
                    "Downloading Norisk Pack '{}' Mods... (Phase 2)",
                    selected_pack_id
                ),
                0.0,
                None,
            )
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
                    emit_progress_event(
                        &state,
                        EventType::DownloadingMods,
                        profile.id,
                        &format!(
                            "Norisk Pack '{}' Mods downloaded successfully! (Phase 2)",
                            selected_pack_id
                        ),
                        1.0,
                        None,
                    )
                    .await?;
                }
                Err(e) => {
                    error!(
                        "Failed to download Norisk Pack '{}' mods: {}",
                        selected_pack_id, e
                    );
                    emit_progress_event(
                        &state,
                        EventType::DownloadingMods,
                        profile.id,
                        &format!("Error downloading Norisk Pack '{}' mods!", selected_pack_id),
                        1.0,
                        Some(e.to_string()),
                    )
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
    let resolve_event_id = emit_progress_event(
        &state,
        EventType::SyncingMods,
        profile.id,
        "Resolving final mod list...",
        0.0,
        None,
    )
    .await?;

    let mod_cache_dir = LAUNCHER_DIRECTORY.meta_dir().join("mod_cache");

    // ---> NEW: Get custom mods for this profile <---
    info!("Listing custom mods for profile '{}'...", profile.name);
    let custom_mod_infos = state.profile_manager.list_custom_mods(&profile).await?;
    info!(
        "Found {} custom mods for profile '{}'",
        custom_mod_infos.len(),
        profile.name
    );
    // ---> END NEW <---

    // Call the resolver function using the already loaded config (or None)
    let target_mods = crate::minecraft::downloads::mod_resolver::resolve_target_mods(
        profile,
        loaded_norisk_config.as_ref(), // Pass the reference directly
        Some(&custom_mod_infos),       // ---> NEW: Pass custom mods <---
        version_id,
        modloader_enum.as_str(),
        &mod_cache_dir,
    )
    .await?;

    emit_progress_event(
        &state,
        EventType::SyncingMods,
        profile.id,
        &format!("Resolved {} mods for sync.", target_mods.len()),
        1.0,
        None,
    )
    .await?;

    // --- Step: Sync mods from cache to profile directory ---
    let sync_event_id = emit_progress_event(
        &state,
        EventType::SyncingMods,
        profile.id,
        "Syncing mods to profile directory... (Phase 3)",
        0.0,
        None,
    )
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
    emit_progress_event(
        &state,
        EventType::SyncingMods,
        profile.id,
        "Mod sync complete! (Phase 3)",
        1.0,
        None,
    )
    .await?;

    // Download log4j configuration if available
    let mut log4j_arg = None;
    if let Some(logging) = &piston_meta.logging {
        info!("\nDownloading log4j configuration...");
        let logging_service = MinecraftLoggingDownloadService::new();
        let config_path = logging_service
            .download_logging_config(&logging.client)
            .await?;
        log4j_arg = Some(logging_service.get_jvm_argument(&config_path));
        info!("Log4j configuration download completed!");
    }

    // Add log4j configuration to JVM arguments if available
    if let Some(log4j_argument) = log4j_arg {
        info!("Adding log4j configuration: {}", log4j_argument);
        let mut jvm_args = launch_params.additional_jvm_args.clone();
        jvm_args.push(log4j_argument);
        launch_params = launch_params.with_additional_jvm_args(jvm_args);
    }

    // --- Launch Minecraft ---
    // Emit launch event
    let launch_event_id = emit_progress_event(
        &state,
        EventType::LaunchingMinecraft,
        profile.id,
        "Minecraft wird gestartet...",
        0.0,
        None,
    )
    .await?;

    launcher.launch(&piston_meta, launch_params).await?;

    emit_progress_event(
        &state,
        EventType::LaunchingMinecraft,
        profile.id,
        "Minecraft wurde gestartet!",
        1.0,
        None,
    )
    .await?;

    Ok(())
}
