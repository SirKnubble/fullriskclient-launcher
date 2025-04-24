use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::{Library, DownloadInfo};
use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncWriteExt, BufReader};
use std::io::Cursor;
use async_zip::tokio::read::seek::ZipFileReader;
use log::info;

const NATIVES_DIR: &str = "natives";

pub struct MinecraftNativesDownloadService {
    base_path: PathBuf,
}

impl MinecraftNativesDownloadService {
    pub fn new() -> Self {
        let base_path = LAUNCHER_DIRECTORY.meta_dir().join(NATIVES_DIR);
        Self { 
            base_path,
        }
    }

    pub async fn extract_natives(&self, libraries: &[Library], version_id: &str) -> Result<()> {
        info!("Extracting natives...");
        
        // Create version-specific natives directory
        let natives_path = self.base_path.join(version_id);
        
        // Clean natives directory
        if natives_path.exists() {
            fs::remove_dir_all(&natives_path).await?;
        }
        fs::create_dir_all(&natives_path).await?;

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
        self.extract_old_natives(libraries, os, arch, &natives_path).await?;
        
        // Then try new method
        self.extract_new_natives(libraries, os, arch, &natives_path).await?;

        info!("\nNative extraction completed!");
        Ok(())
    }

    async fn extract_old_natives(&self, libraries: &[Library], os: &str, arch: &str, natives_path: &PathBuf) -> Result<()> {
        info!("\nStarting old natives detection method...");
        
        for library in libraries {
            info!("\nChecking library: {}", library.name);
            
            if let Some(natives) = &library.natives {
                info!("  Found natives field: {:?}", natives);
                if let Some(classifier) = natives.get(os) {
                    info!("    Found classifier for {}: {}", os, classifier);
                    let classifier = classifier.replace("${arch}", if arch == "x86" { "64" } else { arch });
                    info!("    Resolved classifier: {}", classifier);
                    
                    if let Some(classifiers) = &library.downloads.classifiers {
                        if let Some(native_info) = classifiers.get(&classifier) {
                            info!("    Found native artifact: {}", native_info.url);
                            info!("      Size: {} bytes", native_info.size);
                            info!("      SHA1: {}", native_info.sha1);
                            info!("      Extracting...");
                            self.extract_native_archive(native_info, natives_path).await?;
                        } else {
                            info!("    No native artifact found for classifier: {}", classifier);
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

    async fn extract_new_natives(&self, libraries: &[Library], os: &str, arch: &str, natives_path: &PathBuf) -> Result<()> {
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
                        self.extract_native_archive(artifact, natives_path).await?;
                    } else {
                        info!("      No artifact found");
                    }
                }
            }
        }
        
        info!("\nNew natives detection completed!");
        Ok(())
    }

    async fn extract_native_archive(&self, native: &DownloadInfo, natives_path: &PathBuf) -> Result<()> {
        let target_path = self.get_library_path(native);
        
        // Read the zip file content
        let file_content = fs::read(&target_path).await?;
        let cursor = Cursor::new(file_content);
        let mut reader = BufReader::new(cursor);
        
        let mut zip = ZipFileReader::with_tokio(&mut reader).await.map_err(|e| AppError::Download(e.to_string()))?;
        
        for index in 0..zip.file().entries().len() {
            let entry = &zip.file().entries().get(index).unwrap();
            let file_name = entry.filename().as_str().map_err(|e| AppError::Download(e.to_string()))?;
            
            info!("  Extracting file: {}", file_name);
            
            // Skip META-INF directory
            if file_name.starts_with("META-INF/") {
                info!("    Skipping META-INF entry: {}", file_name);
                continue;
            }

            let path = natives_path.join(file_name);
            let entry_is_dir = file_name.ends_with('/');

            if entry_is_dir {
                if !fs::try_exists(&path).await? {
                    fs::create_dir_all(&path).await?;
                    info!("    Created directory: {:?}", path);
                }
            } else {
                // Create parent directories if they don't exist
                if let Some(parent) = path.parent() {
                    if !fs::try_exists(parent).await? {
                        fs::create_dir_all(parent).await?;
                    }
                }
                
                let mut entry_reader = zip.reader_with_entry(index).await.map_err(|e| AppError::Download(e.to_string()))?;
                let mut writer = fs::File::create(&path).await?;
                
                // Read the entry content into a buffer
                let mut buffer = Vec::new();
                entry_reader.read_to_end_checked(&mut buffer).await.map_err(|e| AppError::Download(e.to_string()))?;
                
                // Write the content asynchronously
                writer.write_all(&buffer).await?;
                info!("    Extracted file to: {:?}", path);
            }
        }

        Ok(())
    }

    fn get_library_path(&self, download_info: &DownloadInfo) -> PathBuf {
        let url = &download_info.url;
        let path = url.split("libraries.minecraft.net/").nth(1)
            .expect("Invalid library URL");
        
        LAUNCHER_DIRECTORY.meta_dir().join("libraries").join(path)
    }
} 