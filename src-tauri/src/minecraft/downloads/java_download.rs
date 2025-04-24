use crate::error::{AppError, Result};
use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::minecraft::dto::{JavaDistribution, ZuluApiResponse};
use crate::utils::system_info::{OS, ARCHITECTURE, OperatingSystem, Architecture};
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

// Legacy Java component that requires x86_64 Java on ARM64 Macs
const LEGACY_JAVA_COMPONENT: &str = "jre-legacy";

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

    // Check if we need to use x86_64 Java based on the Java component
    pub fn needs_x86_64_java(&self, java_component: Option<&str>) -> bool {
        // Only needed on Apple Silicon Macs
        if !cfg!(target_os = "macos") || ARCHITECTURE != Architecture::AARCH64 {
            return false;
        }
        
        // Check if this is a legacy Java component
        match java_component {
            Some(component) if component == LEGACY_JAVA_COMPONENT => {
                info!("⚠️ Legacy Java component '{}' detected on Apple Silicon. Will use x86_64 Java for compatibility.", component);
                true
            },
            _ => false
        }
    }

    pub async fn get_or_download_java(&self, version: u32, distribution: &JavaDistribution, java_component: Option<&str>) -> Result<PathBuf> {
        info!("Checking Java version: {}", version);
        
        // Handle architecture override for legacy Java component on ARM64 Mac
        let force_x86_64 = self.needs_x86_64_java(java_component);
        
        // Check if Java is already downloaded
        if let Ok(java_binary) = self.find_java_binary(distribution, &version, force_x86_64).await {
            info!("Found existing Java installation at: {:?}", java_binary);
            return Ok(java_binary);
        }

        // Download and setup Java
        info!("Downloading Java {}...", version);
        self.download_java(version, distribution, force_x86_64).await?;

        // Find and return Java binary
        self.find_java_binary(distribution, &version, force_x86_64).await
    }

    pub async fn download_java(&self, version: u32, distribution: &JavaDistribution, force_x86_64: bool) -> Result<PathBuf> {
        let arch_suffix = if force_x86_64 { "_x86_64" } else { "" };
        info!("Downloading Java {} for distribution: {}{}", version, distribution.get_name(), arch_suffix);
        
        // Get the initial URL
        let initial_url = distribution.get_url(&version, force_x86_64)?;
        info!("Java Download URL: {}", initial_url);
        
        // For Zulu, we need to make an extra API call to get the actual download URL
        let download_url = if distribution.requires_api_response() {
            info!("Fetching actual download URL from Zulu API...");
            let client = reqwest::Client::new();
            let response = client.get(&initial_url)
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|e| AppError::JavaDownload(format!("Failed to fetch Zulu API: {}", e)))?;
            
            if !response.status().is_success() {
                return Err(AppError::JavaDownload(format!(
                    "Zulu API returned error status: {}",
                    response.status()
                )));
            }
            
            // Parse the JSON response
            let zulu_response: ZuluApiResponse = response.json()
                .await
                .map_err(|e| AppError::JavaDownload(format!("Failed to parse Zulu API response: {}", e)))?;
            
            info!("Actual download URL: {}", zulu_response.url);
            zulu_response.url
        } else {
            initial_url
        };
        
        // Create version-specific directory with architecture suffix for legacy support
        let dir_name = format!("{}_{}{}", distribution.get_name(), version, if force_x86_64 { "_x86_64" } else { "" });
        let version_dir = self.base_path.join(dir_name);
        fs::create_dir_all(&version_dir).await?;

        // Download the Java distribution
        let response = reqwest::get(&download_url)
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
                
                // Determine the common root directory
                let entries = zip.file().entries();
                let mut root_dir: Option<String> = None;
                
                // Find the common root directory
                for entry in entries {
                    let file_name = entry.filename().as_str().map_err(|e| AppError::JavaDownload(e.to_string()))?;
                    
                    if file_name.ends_with('/') && file_name.chars().filter(|&c| c == '/').count() == 1 {
                        // This is a root level directory
                        root_dir = Some(file_name.to_string());
                        break;
                    }
                }
                
                // Extract files, skipping the root directory
                for index in 0..zip.file().entries().len() {
                    let entry = &zip.file().entries().get(index).unwrap();
                    let file_name = entry.filename().as_str().map_err(|e| AppError::JavaDownload(e.to_string()))?;
                    
                    // Skip the root directory itself
                    if let Some(ref root) = root_dir {
                        if file_name == root {
                            continue;
                        }
                    }
                    
                    // Calculate the path without the root directory
                    let relative_path = if let Some(ref root) = root_dir {
                        if file_name.starts_with(root) {
                            file_name[root.len()..].to_string()
                        } else {
                            file_name.to_string()
                        }
                    } else {
                        file_name.to_string()
                    };
                    
                    // Skip empty paths that might result from stripping the root
                    if relative_path.is_empty() {
                        continue;
                    }
                    
                    let path = target_dir.join(&relative_path);
                    let entry_is_dir = relative_path.ends_with('/');

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
                
                // First, find the root directory name
                let mut root_dir = String::new();
                
                for entry in archive.entries()? {
                    let entry = entry?;
                    let path = entry.path()?;
                    
                    if path.components().count() == 1 {
                        if let Some(name) = path.components().next().and_then(|c| c.as_os_str().to_str()) {
                            root_dir = name.to_string();
                            break;
                        }
                    }
                }
                
                // Re-read the archive since we consumed it
                let bytes = fs::read(archive_path).await?;
                let cursor = Cursor::new(bytes);
                let gz = GzDecoder::new(cursor);
                let mut archive = Archive::new(gz);
                
                // Process entries, skipping the root directory
                for entry_result in archive.entries()? {
                    let mut entry = entry_result?;
                    let path = entry.path()?.to_path_buf();
                    
                    // Skip the root directory itself
                    if path.to_string_lossy() == root_dir {
                        continue;
                    }
                    
                    // Create the path without the root directory
                    let relative_path = if let Ok(rel_path) = path.strip_prefix(&root_dir) {
                        rel_path.to_path_buf()
                    } else {
                        // If stripping fails, just use the original path
                        path
                    };
                    
                    // Skip empty paths
                    if relative_path.as_os_str().is_empty() {
                        continue;
                    }
                    
                    let target_path = target_dir.join(relative_path);
                    
                    // Create parent directories
                    if let Some(parent) = target_path.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    
                    entry.unpack(&target_path)?;
                }
            }
            _ => return Err(AppError::JavaDownload("Unsupported OS".to_string())),
        }

        Ok(())
    }

    pub async fn find_java_binary(&self, distribution: &JavaDistribution, version: &u32, force_x86_64: bool) -> Result<PathBuf> {
        let arch_suffix = if force_x86_64 { "_x86_64" } else { "" };
        let runtime_path = self.base_path.join(format!("{}_{}{}", distribution.get_name(), version, arch_suffix));

        // Now that we extract directly to the target directory without the root folder,
        // we should look for the Java binary directly in standard locations
        let java_binary_paths = match OS {
            OperatingSystem::WINDOWS => vec![
                runtime_path.join("bin").join("javaw.exe"),
                runtime_path.join("jre").join("bin").join("javaw.exe")
            ],
            OperatingSystem::OSX => vec![
                runtime_path.join("Contents").join("Home").join("bin").join("java"),
                runtime_path.join("bin").join("java"),
                runtime_path.join("jre").join("bin").join("java")
            ],
            _ => vec![
                runtime_path.join("bin").join("java"),
                runtime_path.join("jre").join("bin").join("java")
            ],
        };

        // Try all possible paths
        for java_binary in java_binary_paths {
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

        // If we couldn't find a binary in the expected locations, let's scan the directory recursively
        self.find_java_binary_recursive(&runtime_path).await
    }

    // Helper method to recursively find Java binary
    async fn find_java_binary_recursive(&self, dir: &PathBuf) -> Result<PathBuf> {
        let binary_name = match OS {
            OperatingSystem::WINDOWS => "javaw.exe",
            _ => "java",
        };

        let mut dirs_to_search = vec![dir.clone()];
        
        while let Some(current_dir) = dirs_to_search.pop() {
            if let Ok(mut entries) = fs::read_dir(&current_dir).await {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let path = entry.path();
                    
                    if path.is_dir() {
                        dirs_to_search.push(path);
                    } else if path.file_name().and_then(|n| n.to_str()) == Some(binary_name) {
                        // Found the Java binary
                        #[cfg(unix)]
                        {
                            use std::os::unix::fs::PermissionsExt;
                            let metadata = fs::metadata(&path).await?;
                            if metadata.permissions().mode() & 0o111 == 0 {
                                let mut permissions = metadata.permissions();
                                permissions.set_mode(metadata.permissions().mode() | 0o111);
                                fs::set_permissions(&path, permissions).await?;
                            }
                        }
                        return Ok(path);
                    }
                }
            }
        }
        
        Err(AppError::JavaDownload("Failed to find Java binary".to_string()))
    }
} 