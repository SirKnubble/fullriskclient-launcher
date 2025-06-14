use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::api::forge_api::ForgeApi;
use crate::minecraft::downloads::{ForgeInstallerDownloadService, ForgeLibrariesDownload};
use crate::minecraft::launch::forge_arguments::ForgeArguments;
use crate::minecraft::ForgePatcher;
use crate::state::event_state::{EventPayload, EventType};
use crate::state::profile_state::Profile;
use crate::state::state_manager::State;
use log::info;
use std::path::PathBuf;
use uuid::Uuid;

pub struct ForgeInstaller {
    java_path: PathBuf,
    concurrent_downloads: usize,
}

impl ForgeInstaller {
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

    pub async fn install(&self, version_id: &str, profile: &Profile) -> Result<ForgeInstallResult> {
        // Emit Forge installation event
        let forge_event_id = Uuid::new_v4();
        let state = State::get().await?;
        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Installing Forge...".to_string(),
                progress: Some(0.0),
                error: None,
            })
            .await?;

        info!("\nInstalling Forge...");

        // Initialize services
        let forge_api = ForgeApi::new();
        let mut forge_libraries_download = ForgeLibrariesDownload::new();
        let forge_installer_download = ForgeInstallerDownloadService::new();

        // Setze die Anzahl der konkurrenten Downloads
        forge_libraries_download.set_concurrent_downloads(self.concurrent_downloads);
        // Forge installer hat möglicherweise keine set_concurrent_downloads Methode

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
                info!(
                    "Attempting to find specific Forge version: {}",
                    specific_version_str
                );

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
                info!(
                    "No specific Forge version set in profile, using latest for MC {}.",
                    version_id
                );
                compatible_versions.first().unwrap().clone() // Unsafe unwrap okay due to is_empty check above
            }
        };
        // --- End Determine Forge Version ---

        info!("Using Forge version: {}", target_forge_version);

        // Emit Forge version found event (using the determined version)
        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: format!("Forge Version {} wird verwendet", target_forge_version),
                progress: Some(0.1),
                error: None,
            })
            .await?;

        // Download and extract Forge installer (using the determined version)
        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Downloading Forge installer...".to_string(),
                progress: Some(0.2),
                error: None,
            })
            .await?;

        forge_installer_download
            .download_installer(&target_forge_version)
            .await?;

        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Forge Installer wird extrahiert...".to_string(),
                progress: Some(0.3),
                error: None,
            })
            .await?;

        let forge_version = forge_installer_download
            .extract_version_json(&target_forge_version)
            .await?;
        let profile_json = forge_installer_download
            .extract_install_profile(&target_forge_version)
            .await?;
        forge_installer_download
            .extract_data_folder(&target_forge_version)
            .await?;
        forge_installer_download
            .extract_maven_folder(&target_forge_version)
            .await?;
        forge_installer_download
            .extract_jars(&target_forge_version)
            .await?;

        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Forge Libraries werden heruntergeladen...".to_string(),
                progress: Some(0.4),
                error: None,
            })
            .await?;

        // Download Forge libraries (still uses forge_version DTO derived from the installer)
        forge_libraries_download
            .download_libraries(&forge_version)
            .await?;
        let libraries = forge_libraries_download
            .get_library_paths(&forge_version, profile_json.is_none())
            .await?;

        info!("Forge Libraries: {:?}", libraries);

        // Use determined target_forge_version for client path and installer path
        let custom_client_path = forge_installer_download.get_client_path(&target_forge_version);
        let installer_path = forge_installer_download.get_installer_path(&target_forge_version);

        let mut force_include_minecraft_jar = false;
        let mut use_custom_client_path = true;

        if let Some(forge_profile) = profile_json {
            state
                .emit_event(EventPayload {
                    event_id: forge_event_id,
                    event_type: EventType::InstallingForge,
                    target_id: Some(profile.id),
                    message: "Forge Installer Libraries werden heruntergeladen...".to_string(),
                    progress: Some(0.6),
                    error: None,
                })
                .await?;

            forge_libraries_download
                .download_installer_libraries(&forge_profile)
                .await?;

            // Prüfen, ob Patching übersprungen werden kann
            let mut should_run_patcher = true;

            // Nur noch PATCHED abrufen
            if let Some(patched) = forge_profile.data.get("PATCHED") {
                let client_path_str = &patched.client;
                // Maven-Koordinaten extrahieren: [group:artifact:version:classifier]
                if client_path_str.starts_with('[') && client_path_str.ends_with(']') {
                    let maven_coords = &client_path_str[1..client_path_str.len() - 1];
                    let parts: Vec<&str> = maven_coords.split(':').collect();

                    if parts.len() >= 4 {
                        let (group, artifact, version, classifier) =
                            (parts[0], parts[1], parts[2], parts[3]);

                        // Berechne Dateipfad
                        let group_path = group.replace('.', "/");
                        let file_name = format!("{}-{}-{}.jar", artifact, version, classifier);

                        let library_path = LAUNCHER_DIRECTORY
                            .meta_dir()
                            .join("libraries")
                            .join(group_path)
                            .join(artifact)
                            .join(version)
                            .join(file_name);

                        info!(
                            "Checking for pre-patched Forge client: {}",
                            library_path.display()
                        );

                        // Prüfe ob die Datei existiert
                        if library_path.exists() {
                            info!(
                                "✅ Pre-patched Forge client found: {}",
                                library_path.display()
                            );
                            should_run_patcher = false;
                        } else {
                            info!(
                                "❌ Patched Forge client file not found, patching required: {}",
                                library_path.display()
                            );
                        }
                    }
                }
            }

            // Patcher nur ausführen, wenn nötig
            if should_run_patcher {
                state
                    .emit_event(EventPayload {
                        event_id: forge_event_id,
                        event_type: EventType::InstallingForge,
                        target_id: Some(profile.id),
                        message: "Forge wird gepatcht...".to_string(),
                        progress: Some(0.7),
                        error: None,
                    })
                    .await?;

                let forge_patcher = ForgePatcher::new(self.java_path.clone(), version_id);
                forge_patcher
                    .with_event_id(forge_event_id)
                    .with_profile_id(profile.id)
                    .apply_processors(&forge_profile, version_id, true, &installer_path)
                    .await?;
            } else {
                state
                    .emit_event(EventPayload {
                        event_id: forge_event_id,
                        event_type: EventType::InstallingForge,
                        target_id: Some(profile.id),
                        message:
                            "Vorgepatchte Forge-Client Datei gefunden, überspringe Patching..."
                                .to_string(),
                        progress: Some(0.7),
                        error: None,
                    })
                    .await?;
            }

            if version_id == "1.12.2" {
                force_include_minecraft_jar = true;
            }
        } else {
            // Restore full event payload for legacy library download
            state
                .emit_event(EventPayload {
                    event_id: forge_event_id,
                    event_type: EventType::InstallingForge,
                    target_id: Some(profile.id),
                    message: "Legacy Forge Libraries werden heruntergeladen...".to_string(),
                    progress: Some(0.8),
                    error: None,
                })
                .await?;

            forge_libraries_download
                .download_legacy_libraries(&forge_version)
                .await?;

            use_custom_client_path = false;
        }

        info!("Forge installation completed!");

        state
            .emit_event(EventPayload {
                event_id: forge_event_id,
                event_type: EventType::InstallingForge,
                target_id: Some(profile.id),
                message: "Forge installation completed!".to_string(),
                progress: Some(1.0),
                error: None,
            })
            .await?;

        let result = ForgeInstallResult {
            libraries,
            main_class: forge_version.main_class.clone(),
            jvm_args: ForgeArguments::get_jvm_arguments(
                &forge_version,
                &LAUNCHER_DIRECTORY.meta_dir().join("libraries"),
                &target_forge_version,
            ),
            game_args: ForgeArguments::get_game_arguments(&forge_version),
            minecraft_arguments: forge_version.minecraft_arguments.clone(),
            custom_client_path: if use_custom_client_path {
                Some(custom_client_path)
            } else {
                None
            },
            force_include_minecraft_jar,
        };

        Ok(result)
    }
}

pub struct ForgeInstallResult {
    pub libraries: Vec<PathBuf>,
    pub main_class: String,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
    pub minecraft_arguments: Option<String>,
    pub custom_client_path: Option<PathBuf>,
    pub force_include_minecraft_jar: bool,
}
