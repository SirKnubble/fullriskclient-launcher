use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::{DownloadInfo, Library};
use async_zip::tokio::read::seek::ZipFileReader;
use log::info;
use std::io::Cursor;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncWriteExt, BufReader};

const NATIVES_DIR: &str = "natives";

pub struct MinecraftNativesDownloadService {
    base_path: PathBuf,
}

impl MinecraftNativesDownloadService {
    pub fn new() -> Self {
        let base_path = LAUNCHER_DIRECTORY.meta_dir().join(NATIVES_DIR);
        Self { base_path }
    }

    pub async fn extract_natives(&self, libraries: &[Library], version_id: &str) -> Result<()> {
        info!("Extracting natives...");

        // Create version-specific natives directory
        let natives_path = self.base_path.join(version_id);

        // Clean natives directory if possible, but don't fail if we can't (might be in use by another instance)
        if natives_path.exists() {
            match fs::remove_dir_all(&natives_path).await {
                Ok(_) => {
                    // Successfully removed, now create it again
                    match fs::create_dir_all(&natives_path).await {
                        Ok(_) => info!("Created fresh natives directory at {:?}", natives_path),
                        Err(e) => {
                            info!("Could not create natives directory after deletion: {}. Will try to use existing directory.", e);
                            // If we can't create it, another process might have created it already
                            if !natives_path.exists() {
                                return Err(AppError::Io(e));
                            }
                        }
                    }
                }
                Err(e) => {
                    info!("Could not clean natives directory: {}. Will try to use existing directory.", e);
                    // Continue with existing directory
                }
            }
        } else {
            // Directory doesn't exist, try to create it
            match fs::create_dir_all(&natives_path).await {
                Ok(_) => info!("Created natives directory at {:?}", natives_path),
                Err(e) => {
                    info!("Could not create natives directory: {}. Will try to use existing directory if it exists now.", e);
                    // If we can't create it, another process might have created it already
                    if !natives_path.exists() {
                        return Err(AppError::Io(e));
                    }
                }
            }
        }

        let os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "osx"
        } else {
            "linux"
        };

        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x86"
        };

        info!("Looking for natives for OS: {} and arch: {}", os, arch);

        // Try old method first
        self.extract_old_natives(libraries, os, arch, &natives_path)
            .await?;

        // Then try new method
        self.extract_new_natives(libraries, os, arch, &natives_path)
            .await?;

        info!("\nNative extraction completed!");
        Ok(())
    }

    async fn extract_old_natives(
        &self,
        libraries: &[Library],
        os: &str,
        arch: &str,
        natives_path: &PathBuf,
    ) -> Result<()> {
        info!("\nStarting old natives detection method...");

        for library in libraries {
            info!("\nChecking library: {}", library.name);

            if let Some(natives) = &library.natives {
                info!("  Found natives field: {:?}", natives);
                if let Some(classifier) = natives.get(os) {
                    info!("    Found classifier for {}: {}", os, classifier);
                    let classifier =
                        classifier.replace("${arch}", if arch == "x86" { "64" } else { arch });
                    info!("    Resolved classifier: {}", classifier);

                    if let Some(classifiers) = &library.downloads.classifiers {
                        if let Some(native_info) = classifiers.get(&classifier) {
                            info!("    Found native artifact: {}", native_info.url);
                            info!("      Size: {} bytes", native_info.size);
                            info!("      SHA1: {}", native_info.sha1);
                            info!("      Extracting...");
                            self.extract_native_archive(native_info, natives_path, library)
                                .await?;
                        } else {
                            info!(
                                "    No native artifact found for classifier: {}",
                                classifier
                            );
                        }
                    } else {
                        info!("    No classifiers found in downloads");
                    }
                } else {
                    info!("    No classifier found for OS: {}", os);
                }
            } else {
                info!("  No natives field found");
            }
        }

        info!("\nOld natives detection completed!");
        Ok(())
    }

    async fn extract_new_natives(
        &self,
        libraries: &[Library],
        os: &str,
        arch: &str,
        natives_path: &PathBuf,
    ) -> Result<()> {
        info!("\nStarting new natives detection method...");

        for library in libraries {
            info!("\nChecking library: {}", library.name);

            let native_patterns = if os == "windows" {
                let mut patterns = vec![];
                if arch == "arm64" {
                    patterns.push(String::from(":natives-windows-arm64"));
                } else if arch == "x86" {
                    patterns.push(String::from(":natives-windows-x86"));
                }
                patterns.push(String::from(":natives-windows"));
                patterns
            } else if os == "osx" {
                let mut patterns = vec![];
                if arch == "aarch64" || arch == "arm64" {
                    patterns.push(String::from(":natives-macos-arm64"));
                }
                patterns.push(String::from(":natives-macos"));
                patterns
            } else {
                vec![format!(":natives-{}", os)]
            };

            info!("  Checking patterns: {:?}", native_patterns);
            for pattern in &native_patterns {
                if library.name.ends_with(pattern) {
                    info!("    Found match with pattern: {}", pattern);
                    if let Some(artifact) = &library.downloads.artifact {
                        info!("      Found artifact: {}", artifact.url);
                        info!("      Size: {} bytes", artifact.size);
                        info!("      SHA1: {}", artifact.sha1);
                        info!("      Extracting...");
                        self.extract_native_archive(artifact, natives_path, library)
                            .await?;
                    } else {
                        info!("      No artifact found");
                    }
                }
            }
        }

        info!("\nNew natives detection completed!");
        Ok(())
    }

    async fn extract_native_archive(
        &self,
        native: &DownloadInfo,
        natives_path: &PathBuf,
        library: &Library,
    ) -> Result<()> {
        let target_path = self.get_library_path(native);

        // Read the zip file content
        let file_content = fs::read(&target_path).await?;
        let cursor = Cursor::new(file_content);
        let mut reader = BufReader::new(cursor);

        let mut zip = ZipFileReader::with_tokio(&mut reader)
            .await
            .map_err(|e| AppError::Download(e.to_string()))?;

        // Extract exclude patterns if any
        let exclude_patterns = if let Some(extract) = &library.extract {
            extract.exclude.clone().unwrap_or_default()
        } else {
            // Default behavior - if no extract.exclude specified, we don't exclude anything
            Vec::new()
        };

        info!("    Using exclude patterns: {:?}", exclude_patterns);

        for index in 0..zip.file().entries().len() {
            let entry = &zip.file().entries().get(index).unwrap();
            let file_name = entry
                .filename()
                .as_str()
                .map_err(|e| AppError::Download(e.to_string()))?;

            info!("  Extracting file: {}", file_name);

            // Check if file should be excluded
            let should_exclude = !exclude_patterns.is_empty()
                && exclude_patterns
                    .iter()
                    .any(|pattern| file_name.starts_with(pattern));

            if should_exclude {
                info!("    Skipping excluded entry: {}", file_name);
                continue;
            }

            let path = natives_path.join(file_name);
            let entry_is_dir = file_name.ends_with('/');

            if entry_is_dir {
                if !fs::try_exists(&path).await? {
                    match fs::create_dir_all(&path).await {
                        Ok(_) => info!("    Created directory: {:?}", path),
                        Err(e) => {
                            info!("    Error creating directory {:?}: {}. Directory might be in use by another instance.", path, e);
                            // Continue with next file
                        }
                    }
                }
            } else {
                // Create parent directories if they don't exist
                if let Some(parent) = path.parent() {
                    if !fs::try_exists(parent).await? {
                        match fs::create_dir_all(parent).await {
                            Ok(_) => {}
                            Err(e) => {
                                info!("    Error creating parent directory {:?}: {}. Directory might be in use by another instance.", parent, e);
                                // Continue with next file, but the file creation will likely fail too
                            }
                        }
                    }
                }

                let mut entry_reader = match zip.reader_with_entry(index).await {
                    Ok(reader) => reader,
                    Err(e) => {
                        info!("    Error getting reader for entry: {}. Skipping file.", e);
                        continue;
                    }
                };

                // Read the entry content into a buffer
                let mut buffer = Vec::new();
                match entry_reader.read_to_end_checked(&mut buffer).await {
                    Ok(_) => {}
                    Err(e) => {
                        info!("    Error reading entry content: {}. Skipping file.", e);
                        continue;
                    }
                };

                // Try to create the file, but don't fail if we can't (might be in use by another instance)
                match fs::File::create(&path).await {
                    Ok(mut writer) => {
                        // Write the content asynchronously
                        match writer.write_all(&buffer).await {
                            Ok(_) => info!("    Extracted file to: {:?}", path),
                            Err(e) => {
                                info!("    Error writing to file {:?}: {}. File might be in use by another instance.", path, e);
                                // Continue with next file
                            }
                        }
                    }
                    Err(e) => {
                        info!("    Error creating file {:?}: {}. File might be in use by another instance.", path, e);
                        // Continue with next file
                    }
                };
            }
        }

        Ok(())
    }

    fn get_library_path(&self, download_info: &DownloadInfo) -> PathBuf {
        let url = &download_info.url;
        let path = url
            .split("libraries.minecraft.net/")
            .nth(1)
            .expect("Invalid library URL");

        LAUNCHER_DIRECTORY.meta_dir().join("libraries").join(path)
    }
}
