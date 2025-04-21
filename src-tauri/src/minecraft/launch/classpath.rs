use std::path::PathBuf;
use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::minecraft::dto::piston_meta::Library;
use crate::minecraft::rules::RuleProcessor;
use std::collections::HashMap;
use log::info;
use crate::minecraft::launch::version::compare_versions;

struct LibraryInfo {
    path: PathBuf,
    version: String,
    priority: u32, // Höhere Zahl = höhere Priorität
}

pub struct ClasspathBuilder {
    entries: Vec<String>,
    libraries: HashMap<String, LibraryInfo>,
    custom_client_jar_path: Option<PathBuf>,
    vanilla_client_jar: Option<PathBuf>,
}

impl ClasspathBuilder {
    pub fn new(minecraft_version: &str) -> Self {
        let client_jar = LAUNCHER_DIRECTORY.meta_dir()
            .join("versions")
            .join(minecraft_version)
            .join(format!("{}.jar", minecraft_version));
        info!("Adding vanilla client jar to classpath: {}", client_jar.to_string_lossy());
        
        Self {
            entries: Vec::new(),
            libraries: HashMap::new(),
            custom_client_jar_path: None,
            vanilla_client_jar: Some(client_jar),
        }
    }

    pub fn add_piston_libraries(&mut self, libraries: &[Library]) -> &mut Self {
        info!("\n=== Processing Vanilla Libraries ===");
        for lib in libraries {
            if !RuleProcessor::should_include_library(&lib.rules) {
                info!("❌ Excluding library due to rules: {}", lib.name);
                continue;
            }

            if let Some(artifact) = &lib.downloads.artifact {
                // Extrahiere den Pfad aus dem Maven-Format (group:artifact:version)
                let parts: Vec<&str> = lib.name.split(':').collect();
                if parts.len() != 3 {
                    info!("❌ Skipping library with invalid format: {}", lib.name);
                    continue;
                }

                let (group, artifact_name, version) = (parts[0], parts[1], parts[2]);
                let jar_name = format!("{}-{}.jar", artifact_name, version);
                let jar_path = LAUNCHER_DIRECTORY.meta_dir()
                    .join("libraries")
                    .join(group.replace('.', "/"))
                    .join(artifact_name)
                    .join(version)
                    .join(&jar_name);

                // Prüfe ob wir diese Library schon haben
                if let Some(existing) = self.libraries.get(artifact_name) {
                    // Nur ersetzen wenn neue Version höher ist
                    if compare_versions(version, &existing.version) == std::cmp::Ordering::Greater {
                        info!("🔄 Replacing library {} ({} -> {})", artifact_name, existing.version, version);
                        self.libraries.insert(
                            artifact_name.to_string(),
                            LibraryInfo {
                                path: jar_path,
                                version: version.to_string(),
                                priority: 0,
                            },
                        );
                    } else {
                        info!("⏩ Skipping library {} (existing version {} is newer or equal to {})",
                            artifact_name, existing.version, version);
                    }
                } else {
                    info!("✅ Adding library: {}", artifact_name);
                    self.libraries.insert(
                        artifact_name.to_string(),
                        LibraryInfo {
                            path: jar_path,
                            version: version.to_string(),
                            priority: 0,
                        },
                    );
                }
            } else {
                info!("❌ Skipping library without artifact: {}", lib.name);
            }
        }
        info!("=== Vanilla Library Processing Complete ===\n");
        self
    }

    pub fn add_additional_libraries(&mut self, libraries: &[PathBuf], priority: u32) -> &mut Self {
        info!("\n=== Processing Additional Libraries ===");
        for library in libraries {
            if let Some(file_name) = library.file_name().and_then(|n| n.to_str()) {
                if !file_name.ends_with(".jar") {
                    info!("❌ Skipping non-jar file: {}", file_name);
                    continue;
                }

                // Extrahiere den Basis-Namen und die Version
                let base_name = file_name.strip_suffix(".jar").unwrap_or(file_name);
                if let Some((name, version)) = base_name.rsplit_once('-') {
                    // Prüfe ob wir diese Library schon haben
                    if let Some(existing) = self.libraries.get(name) {
                        // Nur ersetzen wenn neue Version höher ist
                        if compare_versions(version, &existing.version) == std::cmp::Ordering::Greater {
                            info!("🔄 Replacing library {} ({} -> {})", name, existing.version, version);
                            self.libraries.insert(
                                name.to_string(),
                                LibraryInfo {
                                    path: library.clone(),
                                    version: version.to_string(),
                                    priority,
                                },
                            );
                        } else {
                            info!("⏩ Skipping library {} (existing version {} is newer or equal to {})",
                                name, existing.version, version);
                        }
                    } else {
                        info!("✅ Adding library: {}", name);
                        self.libraries.insert(
                            name.to_string(),
                            LibraryInfo {
                                path: library.clone(),
                                version: version.to_string(),
                                priority,
                            },
                        );
                    }
                } else {
                    info!("❌ Skipping file with invalid format (no version): {}", file_name);
                }
            } else {
                info!("❌ Skipping library with invalid filename");
            }
        }
        info!("=== Additional Library Processing Complete ===\n");
        self
    }

    pub fn set_custom_client_jar(&mut self, path: PathBuf) -> &mut Self {
        info!("Setting custom client jar: {}", path.to_string_lossy());
        self.custom_client_jar_path = Some(path);
        self
    }

    pub fn build(&self, force_include_minecraft_jar: bool) -> String {
        // Füge zuerst die zusätzlichen Libraries hinzu
        let mut all_entries: Vec<String> = self.libraries.values()
            .map(|lib| lib.path.to_string_lossy().to_string())
            .collect();
        
        // Dann die anderen Einträge
        all_entries.extend(self.entries.clone());
        
        if let Some(custom_client_jar) = &self.custom_client_jar_path {
            info!("Using custom client jar: {}", custom_client_jar.display());
            all_entries.push(custom_client_jar.to_string_lossy().to_string());
        } else if let Some(vanilla_jar) = &self.vanilla_client_jar {
            info!("Using vanilla client jar: {}", vanilla_jar.display());
            all_entries.push(vanilla_jar.to_string_lossy().to_string());
        } else {
            info!("⚠️ Warning: No client jar found! This might cause issues.");
        }

        if (force_include_minecraft_jar) {
            if let Some(vanilla_jar) = &self.vanilla_client_jar {
                info!("Force including vanilla client jar: {}", vanilla_jar.display());
                all_entries.push(vanilla_jar.to_string_lossy().to_string());
            }
        }
        
        // Verbinde alle Einträge mit dem System-spezifischen Separator
        all_entries.join(if cfg!(windows) { ";" } else { ":" })
    }
}

fn extract_version_from_filename(filename: &str) -> String {
    // Versuche Version aus dem Dateinamen zu extrahieren
    // Format ist normalerweise: name-version.jar
    if let Some((_, version_part)) = filename.rsplit_once('-') {
        if let Some((version, _)) = version_part.rsplit_once('.') {
            return version.to_string();
        }
    }
    "0.0.0".to_string() // Fallback
} 