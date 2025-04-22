// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod config;
mod error;
pub mod integrations;
mod logging;
mod minecraft;
mod state;
mod utils;
use log::{error, info};
use minecraft::NeoForgeApi;
use rand::seq::SliceRandom;
use std::sync::Arc;

use crate::commands::process_command::{
    get_full_log, get_process, get_processes, get_processes_by_profile, stop_process,
};
use commands::minecraft_auth_command::{
    begin_login, get_accounts, get_active_account, remove_account, set_active_account,
};
use commands::minecraft_command::{
    get_fabric_loader_versions, get_forge_versions, get_minecraft_versions,
    upload_log_to_mclogs_command,
};
use commands::profile_command::{
    add_modrinth_mod_to_profile, create_profile, delete_custom_mod, delete_mod_from_profile,
    delete_profile, get_custom_mods, get_norisk_packs, get_profile, get_system_ram_mb,
    import_local_mods, import_profile_from_file, launch_profile, list_profiles,
    open_profile_folder, search_profiles, set_custom_mod_enabled, set_norisk_mod_status,
    set_profile_mod_enabled, update_modrinth_mod_version, update_profile,
};

// Use statements for registered commands only
use commands::modrinth_commands::{
    get_all_modrinth_versions_for_contexts, get_modrinth_mod_versions, search_modrinth_mods,
}; // Remove or comment out if not needed

#[tokio::main]
async fn main() {
    if let Err(e) = logging::setup_logging().await {
        eprintln!("FEHLER: Logging konnte nicht initialisiert werden: {}", e);
    }

    let neoforge_api = NeoForgeApi::new();
    let versions = neoforge_api.get_all_versions().await;
    println!("Versions: {:?}", versions);
    versions.unwrap().print_parsed_versions();

    info!("--- Running Test Modrinth Search --- DONT FORGET TO REMOVE");
    let query = "fabric".to_string();
    let game_version_filter = Some("1.20.1".to_string());
    let loader_filter = Some("fabric".to_string());
    let limit = Some(25u32);

    match integrations::modrinth::search_mods(
        query.clone(),
        game_version_filter.clone(),
        loader_filter.clone(),
        limit,
    )
    .await
    {
        Ok(results) => {
            info!(
                "Modrinth search successful! Found {} results.",
                results.len()
            );

            if !results.is_empty() {
                let mut rng = rand::thread_rng();
                if let Some(random_hit) = results.choose(&mut rng) {
                    info!(
                        "--- Getting versions for randomly chosen hit: '{}' (ID: {}) ---",
                        random_hit.title, random_hit.project_id
                    );

                    match integrations::modrinth::get_mod_versions(
                        random_hit.project_id.clone(),
                        loader_filter.clone().map(|l| vec![l]),
                        game_version_filter.clone().map(|gv| vec![gv]),
                    )
                    .await
                    {
                        Ok(versions) => {
                            info!(
                                "Found {} versions for '{}' matching filters:",
                                versions.len(),
                                random_hit.title
                            );
                            for (i, version) in versions.iter().take(10).enumerate() {
                                let primary_file = version
                                    .files
                                    .iter()
                                    .find(|f| f.primary)
                                    .map(|f| f.filename.as_str())
                                    .unwrap_or("N/A");
                                info!(
                                    "  Version {}: Name='{}', Number='{}', Type={:?}, File='{}'",
                                    i + 1,
                                    version.name,
                                    version.version_number,
                                    version.version_type,
                                    primary_file
                                );
                            }
                            if versions.len() > 10 {
                                info!("  ... and {} more versions not shown.", versions.len() - 10);
                            }
                        }
                        Err(e) => {
                            error!("Failed to get versions for '{}': {:?}", random_hit.title, e);
                        }
                    }
                } else {
                    error!("Could not choose a random element, although search hits were found.");
                }
            } else {
                info!("No mods found matching the search criteria.");
            }
        }
        Err(e) => {
            error!("Modrinth search failed: {:?}", e);
        }
    }
    info!("--- Finished Test Modrinth Search --- DONT FORGET TO REMOVE");

    info!("Starting NoRiskClient Launcher...");

    tauri::Builder::default()
        //TODO .plugin(minecraft_auth_command::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Initialize the state
            let app_handle = Arc::new(app.handle().clone());
            tauri::async_runtime::spawn(async move {
                if let Err(e) = state::state_manager::State::init(app_handle).await {
                    error!("Failed to initialize state: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_profile,
            get_profile,
            update_profile,
            delete_profile,
            list_profiles,
            search_profiles,
            get_minecraft_versions,
            launch_profile,
            get_processes,
            get_process,
            get_processes_by_profile,
            stop_process,
            begin_login,
            remove_account,
            get_active_account,
            set_active_account,
            get_accounts,
            search_modrinth_mods,      // Explicitly not registered
            get_modrinth_mod_versions, // Explicitly not registered
            add_modrinth_mod_to_profile,
            set_profile_mod_enabled,
            delete_mod_from_profile,
            get_norisk_packs,
            set_norisk_mod_status,
            update_modrinth_mod_version,
            get_all_modrinth_versions_for_contexts,
            get_full_log,
            get_custom_mods,
            set_custom_mod_enabled,
            import_local_mods,
            get_system_ram_mb,
            delete_custom_mod,
            open_profile_folder,
            import_profile_from_file,
            upload_log_to_mclogs_command,
            get_fabric_loader_versions,
            get_forge_versions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
