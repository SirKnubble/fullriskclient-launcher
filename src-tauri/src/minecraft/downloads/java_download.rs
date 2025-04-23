use crate::error::{AppError, Result};
use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::minecraft::dto::JavaDistribution;
use crate::utils::system_info::{OS, OperatingSystem};
use std::path::PathBuf;
use tokio::fs;
use std::io::Cursor;
use tokio::io::{AsyncWriteExt, BufReader};
use reqwest;
use flate2::read::GzDecoder;
use tar::Archive;
use async_zip::tokio::read::seek::ZipFileReader;
use log::info;

const JAVA_DIR: &str = "java";
const DEFAULT_CONCURRENT_EXTRACTIONS: usize = 4;

pub struct JavaDownloadService {
    base_path: PathBuf,
    concurrent_extractions: usize,
}

impl JavaDownloadService {
    pub fn new() -> Self {
        let base_path = LAUNCHER_DIRECTORY.meta_dir().join(JAVA_DIR);
        Self { 
            base_path,
            concurrent_extractions: DEFAULT_CONCURRENT_EXTRACTIONS,
        }
    }

    pub async fn get_or_download_java(&self, version: u32, distribution: &JavaDistribution) -> Result<PathBuf> {
        info!("Checking Java version: {}", version);
        
        // Adjust Java version if needed
        let adjusted_version = if version == 16 {
            info!("⚠️ Java 16 detected, downgrading to Java 8 for compatibility");
            8
        } else {
            info!("✅ Using Java version: {}", version);
            version
        };

        // Check if Java is already downloaded
        if let Ok(java_binary) = self.find_java_binary(distribution, &adjusted_version).await {
            info!("Found existing Java installation at: {:?}", java_binary);
            return Ok(java_binary);
        }

        // Download and setup Java
        info!("Downloading Java {}...", adjusted_version);
        self.download_java(adjusted_version, distribution).await?;

        // Find and return Java binary
        self.find_java_binary(distribution, &adjusted_version).await
    }

    pub async fn download_java(&self, version: u32, distribution: &JavaDistribution) -> Result<PathBuf> {
        info!("Downloading Java {} for distribution: {}", version, distribution.get_name());
        
        // Get the download URL
        let url = distribution.get_url(&version)?;
        info!("Java Download URL: {}", url);
        
        // Create version-specific directory
        let version_dir = self.base_path.join(format!("{}_{}", distribution.get_name(), version));
        fs::create_dir_all(&version_dir).await?;

        // Download the Java distribution
        let response = reqwest::get(&url)
            .await
            .map_err(|e| AppError::JavaDownload(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AppError::JavaDownload(format!(
                "Failed to download Java: Status {}",
                response.status()
            )));
        }

        let bytes = response.bytes()
            .await
            .map_err(|e| AppError::JavaDownload(e.to_string()))?;

        // Save the downloaded file
        let archive_path = version_dir.join(format!("java.{}", OS.get_archive_type()?));
        let mut file = fs::File::create(&archive_path).await?;
        file.write_all(&bytes).await?;

        // Extract the archive
        self.extract_java_archive(&archive_path, &version_dir).await?;

        // Clean up the archive
        fs::remove_file(&archive_path).await?;

        Ok(version_dir)
    }

    async fn extract_java_archive(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        info!("Extracting Java archive...");
        
        match OS {
            OperatingSystem::WINDOWS => {
                // Read the zip file content
                let file_content = fs::read(archive_path).await?;
                let cursor = Cursor::new(file_content);
                let mut reader = BufReader::new(cursor);
                
                let mut zip = ZipFileReader::with_tokio(&mut reader).await.map_err(|e| AppError::JavaDownload(e.to_string()))?;
                
                for index in 0..zip.file().entries().len() {
                    let entry = &zip.file().entries().get(index).unwrap();
                    let file_name = entry.filename().as_str().map_err(|e| AppError::JavaDownload(e.to_string()))?;
                    
                    let path = target_dir.join(file_name);
                    let entry_is_dir: bool = file_name.ends_with('/');

                    if entry_is_dir {
                        if !fs::try_exists(&path).await? {
                            fs::create_dir_all(&path).await?;
                        }
                    } else {
                        // Create parent directories if they don't exist
                        if let Some(parent) = path.parent() {
                            if !fs::try_exists(parent).await? {
                                fs::create_dir_all(parent).await?;
                            }
                        }
                        
                        let mut entry_reader = zip.reader_with_entry(index).await.map_err(|e| AppError::JavaDownload(e.to_string()))?;
                        let mut writer = fs::File::create(&path).await?;
                        
                        // Read the entry content into a buffer
                        let mut buffer = Vec::new();
                        entry_reader.read_to_end_checked(&mut buffer).await.map_err(|e| AppError::JavaDownload(e.to_string()))?;
                        
                        // Write the content asynchronously
                        writer.write_all(&buffer).await?;
                    }
                }
            }
            OperatingSystem::LINUX | OperatingSystem::OSX => {
                // Read the entire archive into memory
                let bytes = fs::read(archive_path).await?;
                let cursor = Cursor::new(bytes);
                let gz = GzDecoder::new(cursor);
                let mut archive = Archive::new(gz);

                // Extract all files
                archive.unpack(target_dir)?;
            }
            _ => return Err(AppError::JavaDownload("Unsupported OS".to_string())),
        }

        Ok(())
    }

    pub async fn find_java_binary(&self, distribution: &JavaDistribution, version: &u32) -> Result<PathBuf> {
        let runtime_path = self.base_path.join(format!("{}_{}", distribution.get_name(), version));

        // Find JRE in runtime folder
        let mut files = fs::read_dir(&runtime_path).await?;

        if let Some(jre_folder) = files.next_entry().await? {
            let folder_path = jre_folder.path();

            let java_binary = match OS {
                OperatingSystem::WINDOWS => folder_path.join("bin").join("javaw.exe"),
                OperatingSystem::OSX => folder_path
                    .join("Contents")
                    .join("Home")
                    .join("bin")
                    .join("java"),
                _ => folder_path.join("bin").join("java"),
            };

            if java_binary.exists() {
                // Check if the binary has execution permissions on linux and macOS
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;

                    let metadata = fs::metadata(&java_binary).await?;

                    if !metadata.permissions().mode() & 0o111 != 0 {
                        // try to change permissions
                        let mut permissions = metadata.permissions();
                        permissions.set_mode(0o111);
                        fs::set_permissions(&java_binary, permissions).await?;
                    }
                }

                return Ok(java_binary);
            }
        }

        Err(AppError::JavaDownload("Failed to find JRE".to_string()))
    }
} 