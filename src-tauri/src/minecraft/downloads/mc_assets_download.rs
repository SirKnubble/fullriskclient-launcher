use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::{AssetIndex, AssetIndexContent, AssetObject};
use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use reqwest;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use futures::stream::{StreamExt, iter};
use log::{info, error, debug, warn, trace};

const ASSETS_DIR: &str = "assets";
const DEFAULT_CONCURRENT_DOWNLOADS: usize = 12;
// concurrent_assets is not used in this implementation

pub struct MinecraftAssetsDownloadService {
    assets_path: PathBuf,
    concurrent_downloads: usize,
}

impl MinecraftAssetsDownloadService {
    pub fn new() -> Self {
        let assets_path = LAUNCHER_DIRECTORY.meta_dir().join(ASSETS_DIR);
        info!("[Assets Service] Initialized. Assets Path: {}", assets_path.display());
        Self {
            assets_path,
            concurrent_downloads: DEFAULT_CONCURRENT_DOWNLOADS,
        }
    }

    pub async fn download_assets(&self, asset_index: &AssetIndex) -> Result<()> {
        trace!("[Assets Download] Starting download process for asset index: {}", asset_index.id);
        let asset_index_content = self.download_asset_index(asset_index).await?;

        let assets: Vec<(String, AssetObject)> = asset_index_content.objects.into_iter().collect();
        let mut downloads = Vec::new();
        let assets_path = self.assets_path.clone();
        let task_counter = Arc::new(AtomicUsize::new(1)); // Start counter at 1

        trace!("[Assets Download] Preparing {} potential jobs...", assets.len());
        let mut job_count = 0;
        for (name, asset) in assets {
            let hash = asset.hash.clone();
            let size = asset.size;
            let target_path = assets_path
                .join("objects")
                .join(&hash[..2])
                .join(&hash);
            let name_clone = name.clone(); // Clone name for the async block
            let task_counter_clone = Arc::clone(&task_counter);

            // Check if asset exists and size matches
            if fs::try_exists(&target_path).await? {
                if let Ok(metadata) = fs::metadata(&target_path).await {
                    if metadata.len() as i64 == size {
                        trace!("[Assets Download] Skipping asset {} (already exists with correct size)", name_clone);
                        continue; // Skip this asset
                    }
                    warn!("[Assets Download] Asset {} exists but size mismatch (expected {}, got {}), redownloading.", name_clone, size, metadata.len());
                }
            }

            job_count += 1;
            downloads.push(async move {
                let task_id = task_counter_clone.fetch_add(1, Ordering::SeqCst);
                trace!("[Assets Download Task {}] Starting download for: {}", task_id, name_clone);
                let url = format!(
                    "https://resources.download.minecraft.net/{}/{}",
                    &hash[..2],
                    hash
                );

                let response_result = reqwest::get(&url).await;

                let response = match response_result {
                    Ok(resp) => resp,
                    Err(e) => {
                        error!("[Assets Download Task {}] Request error for {}: {}", task_id, name_clone, e);
                        return Err(AppError::Download(format!(
                            "Failed to initiate download for asset {}: {}",
                            name_clone,
                            e
                        )));
                    }
                };

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "No error details available".to_string());
                    error!("[Assets Download Task {}] Failed download for {}: Status {}, Error: {}", task_id, name_clone, status, error_text);
                    return Err(AppError::Download(format!(
                        "Failed to download asset {} - Status {}: {}",
                        name_clone,
                        status,
                        error_text
                    )));
                }

                let bytes_result = response.bytes().await;
                let bytes = match bytes_result {
                    Ok(b) => b,
                    Err(e) => {
                         error!("[Assets Download Task {}] Error reading bytes for {}: {}", task_id, name_clone, e);
                         return Err(AppError::Download(format!(
                            "Failed to read bytes for asset {}: {}",
                            name_clone,
                            e
                        )));
                    }
                };

                if let Some(parent) = target_path.parent() {
                    if let Err(e) = fs::create_dir_all(parent).await {
                        error!("[Assets Download Task {}] Error creating directory for {}: {}", task_id, name_clone, e);
                         return Err(AppError::Io(e));
                    }
                }

                let file_result = fs::File::create(&target_path).await;
                let mut file = match file_result {
                    Ok(f) => f,
                    Err(e) => {
                        error!("[Assets Download Task {}] Error creating file for {}: {}", task_id, name_clone, e);
                         return Err(AppError::Io(e));
                    }
                };

                if let Err(e) = file.write_all(&bytes).await {
                    error!("[Assets Download Task {}] Error writing file for {}: {}", task_id, name_clone, e);
                     return Err(AppError::Io(e));
                }

                info!("[Assets Download Task {}] Finished download for: {}", task_id, name_clone);
                Ok(())
            });
        }
        info!("[Assets Download] Queued {} actual download tasks.", job_count);

        info!("[Assets Download] Processing tasks with {} concurrent downloads...", self.concurrent_downloads);
        let results: Vec<Result<()>> = iter(downloads)
            .buffer_unordered(self.concurrent_downloads)
            .collect()
            .await;

        // Check for errors after all downloads are attempted
        let mut errors = Vec::new();
        for result in results {
            if let Err(e) = result {
                errors.push(e);
            }
        }

        if !errors.is_empty() {
            // Log all errors encountered
            error!("[Assets Download] Finished with {} errors:", errors.len());
            for error_item in &errors {
                error!("  - {}", error_item);
            }
            // Return the first error encountered to signal failure
            Err(errors.remove(0))
        } else {
            info!("[Assets Download] All asset downloads completed successfully.");
            Ok(())
        }
    }

    async fn download_asset_index(&self, asset_index: &AssetIndex) -> Result<AssetIndexContent> {
        let index_path = self.assets_path.join("indexes").join(format!("{}.json", asset_index.id));

        // Check if index file exists and size matches
        if fs::try_exists(&index_path).await? {
            if let Ok(metadata) = fs::metadata(&index_path).await {
                if metadata.len() as i64 == asset_index.size {
                    info!("[Assets Download] Asset index {} already exists with correct size.", asset_index.id);
                    let content = fs::read(&index_path).await?;
                    return Ok(serde_json::from_slice(&content)?);
                }
                 warn!("[Assets Download] Asset index {} exists but size mismatch (expected {}, got {}), redownloading.", asset_index.id, asset_index.size, metadata.len());
            }
        }

        info!("[Assets Download] Downloading asset index: {}", asset_index.id);
        let response_result = reqwest::get(&asset_index.url).await;
        let response = match response_result {
            Ok(resp) => resp,
            Err(e) => {
                error!("[Assets Download] Failed request for asset index {}: {}", asset_index.id, e);
                return Err(AppError::Download(format!(
                    "Failed to download asset index {}: {}",
                    asset_index.id, e
                )));
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "No error details available".to_string());
            error!("[Assets Download] Failed response for asset index {}: Status {}, Error: {}", asset_index.id, status, error_text);
            return Err(AppError::Download(
                format!("Failed to download asset index {} - Status {}: {}", asset_index.id, status, error_text)
            ));
        }

        let bytes_result = response.bytes().await;
        let bytes = match bytes_result {
            Ok(b) => b,
            Err(e) => {
                error!("[Assets Download] Failed reading bytes for asset index {}: {}", asset_index.id, e);
                return Err(AppError::Download(format!(
                    "Failed to read bytes for asset index {}: {}",
                    asset_index.id, e
                )));
            }
        };

        // Ensure parent directory exists
        if let Some(parent) = index_path.parent() {
            if let Err(e) = fs::create_dir_all(parent).await {
                error!("[Assets Download] Failed creating directory for asset index {}: {}", asset_index.id, e);
                return Err(AppError::Io(e));
            }
        }

        // Write the index file
        let file_result = fs::File::create(&index_path).await;
        let mut file = match file_result {
            Ok(f) => f,
            Err(e) => {
                error!("[Assets Download] Failed creating file for asset index {}: {}", asset_index.id, e);
                return Err(AppError::Io(e));
            }
        };

        if let Err(e) = file.write_all(&bytes).await {
             error!("[Assets Download] Failed writing file for asset index {}: {}", asset_index.id, e);
             return Err(AppError::Io(e));
        }

        info!("[Assets Download] Successfully downloaded asset index: {}", asset_index.id);

        Ok(serde_json::from_slice(&bytes)?)
    }
} 