use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::error::{AppError, Result};
use crate::minecraft::{NeoForgeApi, NeoForgePatcher};
use crate::minecraft::downloads::{NeoForgeInstallerDownloadService, NeoForgeLibrariesDownload};
use crate::minecraft::launch::neo_forge_arguments::NeoForgeArguments;
use crate::state::event_state::{EventPayload, EventType};
use crate::state::profile_state::Profile;
use crate::state::state_manager::State;
use log::info;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub struct NeoForgeInstaller {
    java_path: PathBuf,
    concurrent_downloads: usize,
}

impl NeoForgeInstaller {
    pub fn new(java_path: PathBuf) -> Self {
        Self { 
            java_path,
            concurrent_downloads: 10, // Default value
        }
    }
    
    pub fn set_concurrent_downloads(&mut self, count: usize) -> &mut Self {
        self.concurrent_downloads = count;
        self
    }

    pub async fn install(&self, version_id: &str, profile: &Profile) -> Result<NeoForgeInstallResult> {
        // Emit NeoForge installation event
        let neoforge_event_id = Uuid::new_v4();
        let state = State::get().await?;
        state
            .emit_event(EventPayload {
                event_id: neoforge_event_id,
                event_type: EventType::InstallingNeoForge,
                target_id: Some(profile.id),
                message: "NeoForge wird installiert...".to_string(),
                progress: Some(0.0),
                error: None,
            })
            .await?;

        info!("\nInstalling NeoForge...");

        // Initialize services
        let neoforge_api = NeoForgeApi::new();
        let mut neoforge_libraries_download = NeoForgeLibrariesDownload::new();
        let neoforge_installer_download = NeoForgeInstallerDownloadService::new();
        
        // Setze die Anzahl der konkurrenten Downloads
        neoforge_libraries_download.set_concurrent_downloads(self.concurrent_downloads);

        // Get all NeoForge versions metadata
        let neoforge_metadata = neoforge_api.get_all_versions().await?;
        // Get versions compatible with the current Minecraft version
        let compatible_versions = neoforge_metadata.get_versions_for_minecraft(version_id);

        if compatible_versions.is_empty() {
            return Err(AppError::VersionNotFound(format!(
                "No NeoForge versions found for Minecraft {}",
                version_id
            )));
        }

        // --- Determine NeoForge Version --- 
        let target_neoforge_version = match &profile.loader_version {
            Some(specific_version_str) if !specific_version_str.is_empty() => {
                info!("Attempting to find specific NeoForge version: {}", specific_version_str);
                
                // Check if the specific version exists in the compatible list
                if compatible_versions.contains(specific_version_str) {
                    info!("Found specified NeoForge version: {}", specific_version_str);
                    specific_version_str.clone() // Clone the string to own it
                } else {
                    log::warn!(
                        "Specified NeoForge version '{}' not found or incompatible with MC {}. Falling back to latest.",
                        specific_version_str, version_id
                    );
                    // Fallback to the latest compatible version (first in the list from get_versions_for_minecraft)
                    compatible_versions.first().unwrap().clone() // Unsafe unwrap okay due to is_empty check above
                }
            }
            _ => {
                // Fallback to latest compatible if no specific version is set
                info!("No specific NeoForge version set in profile, using latest for MC {}.", version_id);
                 compatible_versions.first().unwrap().clone() // Unsafe unwrap okay due to is_empty check above
            }
        };
        // --- End Determine NeoForge Version ---

        info!("Using NeoForge version: {}", target_neoforge_version);

        // Emit NeoForge version found event (using the determined version)
        state.emit_event(EventPayload {
            event_id: neoforge_event_id, 
            event_type: EventType::InstallingNeoForge, 
            target_id: Some(profile.id), 
            message: format!("NeoForge Version {} wird verwendet", target_neoforge_version), 
            progress: Some(0.1), 
            error: None 
        }).await?;

        // Download and extract NeoForge installer (using the determined version)
        state.emit_event(EventPayload {
            event_id: neoforge_event_id,
            event_type: EventType::InstallingNeoForge,
            target_id: Some(profile.id),
            message: "NeoForge Installer wird heruntergeladen...".to_string(),
            progress: Some(0.2),
            error: None,
        }).await?;

        neoforge_installer_download
            .download_installer(&target_neoforge_version)
            .await?;

        state.emit_event(EventPayload {
            event_id: neoforge_event_id,
            event_type: EventType::InstallingNeoForge,
            target_id: Some(profile.id),
            message: "NeoForge Installer wird extrahiert...".to_string(),
            progress: Some(0.3),
            error: None,
        }).await?;

        let neoforge_version = neoforge_installer_download.extract_version_json(&target_neoforge_version).await?;
        let profile_json = neoforge_installer_download.extract_install_profile(&target_neoforge_version).await?;
        neoforge_installer_download.extract_data_folder(&target_neoforge_version).await?;
        neoforge_installer_download.extract_maven_folder(&target_neoforge_version).await?;
        neoforge_installer_download.extract_jars(&target_neoforge_version).await?;

        state.emit_event(EventPayload {
            event_id: neoforge_event_id,
            event_type: EventType::InstallingNeoForge,
            target_id: Some(profile.id),
            message: "NeoForge Libraries werden heruntergeladen...".to_string(),
            progress: Some(0.4),
            error: None,
        }).await?;

        // Download NeoForge libraries
        neoforge_libraries_download
            .download_libraries(&neoforge_version)
            .await?;
        let libraries = neoforge_libraries_download
            .get_library_paths(&neoforge_version, profile_json.is_none())
            .await?;

        info!("NeoForge Libraries: {:?}", libraries);
        let neo_forge_game_arguments = NeoForgeArguments::get_game_arguments(&neoforge_version);

        // Use determined target_neoforge_version for client path and installer path
        let custom_client_path = neoforge_installer_download.get_client_path(&target_neoforge_version);
        let installer_path = neoforge_installer_download.get_installer_path(&target_neoforge_version);

        let mut uses_neoforgeclient = false;

        if let Some(neoforge_profile) = profile_json {
            state.emit_event(EventPayload {
                event_id: neoforge_event_id,
                event_type: EventType::InstallingNeoForge,
                target_id: Some(profile.id),
                message: "NeoForge Installer Libraries werden heruntergeladen...".to_string(),
                progress: Some(0.6),
                error: None,
            }).await?;

            neoforge_libraries_download
                .download_installer_libraries(&neoforge_profile)
                .await?;

            state.emit_event(EventPayload {
                event_id: neoforge_event_id,
                event_type: EventType::InstallingNeoForge,
                target_id: Some(profile.id),
                message: "NeoForge wird gepatcht...".to_string(),
                progress: Some(0.7),
                error: None,
            }).await?;

            let forge_patcher = NeoForgePatcher::new(self.java_path.clone(), version_id);
            // Use determined installer_path
            forge_patcher
                .with_event_id(neoforge_event_id)
                .with_profile_id(profile.id)
                .apply_processors(&neoforge_profile, version_id, true, &installer_path)
                .await?;

            // Check if using neoforgeclient flag
            if neo_forge_game_arguments.contains(&"neoforgeclient".to_string()) {
                uses_neoforgeclient = true;
            }
        } else {
            // Restore full event payload for legacy library download
            state.emit_event(EventPayload {
                event_id: neoforge_event_id,
                event_type: EventType::InstallingNeoForge,
                target_id: Some(profile.id),
                message: "Legacy NeoForge Libraries werden heruntergeladen...".to_string(),
                progress: Some(0.8),
                error: None,
            }).await?;

            neoforge_libraries_download
                .download_legacy_libraries(&neoforge_version)
                .await?;
        }

        info!("NeoForge installation completed!");

        state.emit_event(EventPayload {
            event_id: neoforge_event_id,
            event_type: EventType::InstallingNeoForge,
            target_id: Some(profile.id),
            message: "NeoForge Installation abgeschlossen!".to_string(),
            progress: Some(1.0),
            error: None,
        }).await?;

        let result = NeoForgeInstallResult {
            libraries,
            main_class: neoforge_version.main_class.clone(),
            jvm_args: NeoForgeArguments::get_jvm_arguments(
                &neoforge_version,
                &LAUNCHER_DIRECTORY.meta_dir().join("libraries"),
                &target_neoforge_version,
            ),
            game_args: neo_forge_game_arguments,
            minecraft_arguments: neoforge_version.minecraft_arguments.clone(),
            custom_client_path: Some(custom_client_path),
            uses_neoforgeclient,
        };

        Ok(result)
    }
}

pub struct NeoForgeInstallResult {
    pub libraries: Vec<PathBuf>,
    pub main_class: String,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
    pub minecraft_arguments: Option<String>,
    pub custom_client_path: Option<PathBuf>,
    pub uses_neoforgeclient: bool,
} 