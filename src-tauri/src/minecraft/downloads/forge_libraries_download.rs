use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::dto::forge_install_profile::ForgeInstallProfile;
use crate::minecraft::dto::forge_meta::ForgeVersion;
use crate::utils::download_utils::{DownloadConfig, DownloadUtils};
use futures::stream::{iter, StreamExt};
use log::info;
use std::path::PathBuf;
use tokio::fs;

const LIBRARIES_DIR: &str = "libraries";
const DEFAULT_CONCURRENT_DOWNLOADS: usize = 10;

/// Single forgeloader version used for all Forge + NeoForge MC versions.
/// Artifact version is constructed as: {FORGELOADER_VERSION}+{loader}.{mc_version}
const FORGELOADER_VERSION: &str = "26.1.5-launcher";
const FORGELOADER_MAVEN_BASE: &str = "https://maven.norisk.gg/repository/norisk-production/gg/norisk/nrc-forgeloader";

/// Known MC versions with published forgeloader artifacts, ordered ascending.
/// If a requested version isn't in the list, we fall back to the latest entry for that loader.
const FORGE_VERSIONS: &[&str] = &[
    "1.7.10", "1.8.9", "1.12.2", "1.14.4", "1.15.2", "1.16.5",
    "1.17.1", "1.18.2", "1.19.2", "1.19.4", "1.20.1",
    "1.21.1", "1.21.3", "1.21.4", "1.21.5", "1.21.6", "1.21.7", "1.21.8",
];
const NEOFORGE_VERSIONS: &[&str] = &[
    "1.20.2", "1.20.3", "1.20.4", "1.20.5", "1.20.6",
    "1.21", "1.21.1", "1.21.2", "1.21.3", "1.21.4", "1.21.5",
    "1.21.6", "1.21.7", "1.21.8", "1.21.9", "1.21.10", "1.21.11",
];

pub struct ForgeLibrariesDownload {
    base_path: PathBuf,
    concurrent_downloads: usize,
}

impl ForgeLibrariesDownload {
    pub fn new() -> Self {
        let base_path = LAUNCHER_DIRECTORY.meta_dir().join(LIBRARIES_DIR);
        Self {
            base_path,
            concurrent_downloads: DEFAULT_CONCURRENT_DOWNLOADS,
        }
    }

    pub fn set_concurrent_downloads(&mut self, count: usize) {
        self.concurrent_downloads = count;
    }

    pub async fn download_libraries(&self, forge_version: &ForgeVersion) -> Result<()> {
        let mut downloads = Vec::new();

        for library in &forge_version.libraries {
            if let Some(downloads_info) = &library.downloads {
                if let Some(artifact) = &downloads_info.artifact {
                    downloads.push(self.download_file(artifact));
                }

                for (_, artifact) in &downloads_info.classifiers {
                    downloads.push(self.download_file(artifact));
                }
            }
        }

        info!("Found {} files to download", downloads.len());
        info!(
            "Downloading with {} concurrent downloads",
            self.concurrent_downloads
        );

        // Execute downloads concurrently
        let results: Vec<Result<()>> = iter(downloads)
            .buffer_unordered(self.concurrent_downloads)
            .collect()
            .await;

        // Check for errors
        let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();

        if !errors.is_empty() {
            info!("\n⚠️ Some downloads failed:");
            for error in errors {
                info!("  - {}", error);
            }
            return Err(AppError::Download(
                "Some library downloads failed".to_string(),
            ));
        }

        Ok(())
    }

    async fn download_file(
        &self,
        download_info: &crate::minecraft::dto::forge_meta::ForgeDownloadInfo,
    ) -> Result<()> {
        // Skip if URL is empty
        if download_info.url.is_empty() {
            info!("⏩ Skipping file with empty URL: {}", download_info.path);
            return Ok(());
        }

        let target_path = self.get_library_path(download_info);
        info!("⬇️ Downloading: {}", download_info.path);

        // Use the new centralized download utility with SHA1 verification
        let mut config = DownloadConfig::new()
            .with_streaming(false)  // Libraries are typically small-medium files
            .with_retries(3);  // Built-in retry logic

        // Add SHA1 verification if available
        if let Some(sha1) = &download_info.sha1 {
            config = config.with_sha1(sha1.clone());
        }

        DownloadUtils::download_file(&download_info.url, &target_path, config).await?;

        info!("💾 Saved: {}", download_info.path);
        Ok(())
    }

    fn get_library_path(
        &self,
        download_info: &crate::minecraft::dto::forge_meta::ForgeDownloadInfo,
    ) -> PathBuf {
        self.base_path.join(&download_info.path)
    }

    pub async fn get_library_paths(
        &self,
        forge_version: &ForgeVersion,
        is_legacy: bool,
    ) -> Result<Vec<PathBuf>> {
        let mut paths = Vec::new();

        for library in &forge_version.libraries {
            if is_legacy {
                // Legacy Format: Baue den Pfad aus dem Namen
                let parts: Vec<&str> = library.name.split(':').collect();
                if parts.len() < 3 {
                    info!("❌ Invalid legacy library format: {}", library.name);
                    continue;
                }

                let group = parts[0].replace('.', "/");
                let artifact = parts[1];
                let version = parts[2];

                // Spezialfall für Forge-Bibliotheken
                let is_forge_lib = group == "net/minecraftforge" && artifact == "forge";
                let suffix = if is_forge_lib {
                    info!(
                        "🔧 Detected Forge library, adding -universal suffix: {}",
                        library.name
                    );
                    "-universal"
                } else {
                    ""
                };

                let maven_path = format!(
                    "{}/{}/{}/{}-{}{}.jar",
                    group, artifact, version, artifact, version, suffix
                );

                let target_path = self.base_path.join(&maven_path);
                info!("Adding Legacy Library Path: {}", target_path.display());
                paths.push(target_path);
            } else {
                // Modernes Format: Verwende downloads.artifact
                if let Some(downloads) = &library.downloads {
                    if let Some(artifact) = &downloads.artifact {
                        info!(
                            "Adding Modern Library Path: {}",
                            self.get_library_path(artifact).display()
                        );
                        paths.push(self.get_library_path(artifact));
                    }

                    for (_, artifact) in &downloads.classifiers {
                        paths.push(self.get_library_path(artifact));
                    }
                }
            }
        }

        Ok(paths)
    }

    pub async fn download_installer_libraries(&self, profile: &ForgeInstallProfile) -> Result<()> {
        let mut downloads = Vec::new();

        for library in &profile.libraries {
            if let Some(downloads_info) = &library.downloads {
                if let Some(artifact) = &downloads_info.artifact {
                    downloads.push(self.download_file(artifact));
                }

                for (_, artifact) in &downloads_info.classifiers {
                    downloads.push(self.download_file(artifact));
                }
            }
        }

        info!("Found {} installer libraries to download", downloads.len());

        // Execute downloads concurrently
        let results: Vec<Result<()>> = iter(downloads)
            .buffer_unordered(self.concurrent_downloads)
            .collect()
            .await;

        // Check for errors
        let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();

        if !errors.is_empty() {
            info!("\n⚠️ Some installer library downloads failed:");
            for error in errors {
                info!("  - {}", error);
            }
            return Err(AppError::Download(
                "Some installer library downloads failed".to_string(),
            ));
        }

        Ok(())
    }

    pub async fn download_legacy_libraries(&self, forge_version: &ForgeVersion) -> Result<()> {
        let mut downloads = Vec::new();
        let mut skipped = 0;
        let mut invalid = 0;

        info!("\n🔍 Starting legacy library download:");
        info!(
            "📚 Total libraries to process: {}",
            forge_version.libraries.len()
        );

        for library in &forge_version.libraries {
            // Erstelle den Maven-Pfad aus dem Namen
            let parts: Vec<&str> = library.name.split(':').collect();
            if parts.len() < 3 {
                info!("❌ Invalid library format: {}", library.name);
                invalid += 1;
                continue;
            }

            let group = parts[0].replace('.', "/");
            let artifact = parts[1];
            let version = parts[2];

            let maven_path = format!(
                "{}/{}/{}/{}-{}.jar",
                group, artifact, version, artifact, version
            );

            // Erstelle die Download-URL
            //digga wie random ist das alles bitte einfach dann von hier anstatt maven central
            let base_url = library
                .url
                .as_deref()
                .unwrap_or("https://libraries.minecraft.net/");
            let url = format!("{}{}", base_url, maven_path);

            let target_path = self.base_path.join(&maven_path);

            // Prüfe ob die Datei bereits existiert
            if fs::try_exists(&target_path).await? {
                info!("📦 Library already exists: {}", maven_path);
                skipped += 1;
                continue;
            }

            // Erstelle das Verzeichnis falls es nicht existiert
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).await?;
            }

            // Füge den Download zur Liste hinzu
            downloads.push(async move {
                info!("\n⬇️ Downloading: {}", maven_path);
                info!("  📎 URL: {}", url);

                // Use the new centralized download utility for legacy libraries
                let config = DownloadConfig::new()
                    .with_streaming(false)  // Legacy libraries are typically small-medium files
                    .with_retries(2);  // Reduced retries for faster processing

                match DownloadUtils::download_file(&url, &target_path, config).await {
                    Ok(()) => {
                        info!("✅ Successfully downloaded: {}", maven_path);
                        Ok(())
                    }
                    Err(e) => {
                        info!("❌ Failed to download library '{}': {}", library.name, e);
                        Ok(()) // Continue with other downloads even if one fails
                    }
                }
            });
        }

        info!("\n📊 Download Summary:");
        info!("  - Total libraries: {}", forge_version.libraries.len());
        info!("  - Already exists: {}", skipped);
        info!("  - Invalid format: {}", invalid);
        info!("  - To download: {}", downloads.len());
        info!("  - Concurrent downloads: {}", self.concurrent_downloads);

        // Führe Downloads parallel aus
        let results: Vec<Result<()>> = iter(downloads)
            .buffer_unordered(self.concurrent_downloads)
            .collect()
            .await;

        // Prüfe auf Fehler
        let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();

        if !errors.is_empty() {
            info!("\n⚠️ Some legacy library downloads failed:");
            for error in errors {
                info!("  - {}", error);
            }
            return Err(AppError::Download(
                "Some legacy library downloads failed".to_string(),
            ));
        }

        info!("\n✨ All legacy libraries processed successfully!");
        Ok(())
    }

    /// Resolves the nrc-forgeloader JAR for the given MC version and loader type.
    /// If the exact MC version has no published artifact, falls back to the latest
    /// known version for that loader (e.g. 1.21.13 → 1.21.11 for neoforge).
    /// Downloads from Maven if not cached. Returns the JAR path for `-cp`.
    pub async fn resolve_forgeloader(&self, minecraft_version: &str, loader: &str) -> Result<PathBuf> {
        let known_versions = match loader {
            "neoforge" => NEOFORGE_VERSIONS,
            _ => FORGE_VERSIONS,
        };

        let resolved_version = if known_versions.contains(&minecraft_version) {
            minecraft_version.to_string()
        } else {
            // Fall back to the latest known version for this loader
            let fallback = known_versions.last().ok_or_else(|| {
                AppError::Other(format!("No known forgeloader versions for {}", loader))
            })?;
            info!(
                "MC version {} not in known {} versions, falling back to {}",
                minecraft_version, loader, fallback
            );
            fallback.to_string()
        };

        let artifact_version = format!("{}+{}.{}", FORGELOADER_VERSION, loader, resolved_version);
        let maven_path = format!(
            "gg/norisk/nrc-forgeloader/{0}/nrc-forgeloader-{0}.jar",
            artifact_version
        );
        let jar_path = self.base_path.join(&maven_path);

        if !jar_path.exists() {
            if let Some(parent) = jar_path.parent() {
                fs::create_dir_all(parent).await?;
            }
            let encoded_version = artifact_version.replace("+", "%2B");
            let url = format!(
                "{}/{1}/nrc-forgeloader-{1}.jar",
                FORGELOADER_MAVEN_BASE,
                encoded_version
            );
            info!("Downloading forgeloader: {}", url);
            DownloadUtils::download_file(
                &url,
                &jar_path,
                DownloadConfig::new().with_streaming(true).with_retries(3),
            ).await?;
        }

        info!("Forgeloader JAR: {:?}", jar_path);
        Ok(jar_path)
    }
}
