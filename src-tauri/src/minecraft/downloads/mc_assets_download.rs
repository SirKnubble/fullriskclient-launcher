use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::{AssetIndex, AssetIndexContent, AssetObject};
use crate::state::event_state::{EventPayload, EventType};
use crate::state::State;
use crate::utils::mc_utils;
use futures::stream::{iter, StreamExt};
use log::{debug, error, info, trace, warn};
use reqwest;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

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
        info!(
            "[Assets Service] Initialized. Assets Path: {}",
            assets_path.display()
        );
        Self {
            assets_path,
            concurrent_downloads: DEFAULT_CONCURRENT_DOWNLOADS,
        }
    }

    /// Sets the number of concurrent downloads to use
    pub fn with_concurrent_downloads(mut self, concurrent_downloads: usize) -> Self {
        self.concurrent_downloads = concurrent_downloads;
        self
    }

    /// Download Minecraft assets with progress events
    pub async fn download_assets_with_progress(
        &self,
        asset_index: &AssetIndex,
        profile_id: Uuid,
    ) -> Result<()> {
        trace!(
            "[Assets Download] Starting download process for asset index: {}",
            asset_index.id
        );

        // Get state for events
        let state = State::get().await?;

        // Emit initial progress event
        self.emit_progress_event(
            &state,
            profile_id,
            &format!("Starting download for asset index: {}", asset_index.id),
            0.05,
            None,
        )
        .await?;

        // Try to reuse existing Minecraft assets first
        info!("[Assets Download] Checking if we can reuse existing Minecraft assets");

        // Use the progress-aware version
        let assets_reused =
            mc_utils::try_reuse_minecraft_assets_with_progress(asset_index, profile_id).await?;

        if assets_reused {
            info!("[Assets Download] Successfully reused existing Minecraft assets");
            // Even if we copied the index, we should check if any assets are missing
            debug!("[Assets Download] Checking for any missing assets that need to be downloaded");

            self.emit_progress_event(
                &state,
                profile_id,
                "Reused existing Minecraft assets. Checking for missing files...",
                0.2,
                None,
            )
            .await?;
        } else {
            info!("[Assets Download] No existing assets found or could not be reused, proceeding with download");

            self.emit_progress_event(
                &state,
                profile_id,
                "Downloading Minecraft assets index...",
                0.1,
                None,
            )
            .await?;
        }

        let asset_index_content = self.download_asset_index(asset_index).await?;

        self.emit_progress_event(
            &state,
            profile_id,
            &format!(
                "Asset index downloaded. Found {} assets to process",
                asset_index_content.objects.len()
            ),
            0.15,
            None,
        )
        .await?;

        let assets: Vec<(String, AssetObject)> = asset_index_content.objects.into_iter().collect();
        let mut downloads = Vec::new();
        let assets_path = self.assets_path.clone();
        let task_counter = Arc::new(AtomicUsize::new(1)); // Start counter at 1
        let completed_counter = Arc::new(AtomicUsize::new(0));
        let total_to_download = Arc::new(AtomicUsize::new(0));
        let total_assets = assets.len();

        trace!(
            "[Assets Download] Preparing {} potential jobs...",
            assets.len()
        );
        let mut job_count = 0;

        for (name, asset) in assets {
            let hash = asset.hash.clone();
            let size = asset.size;
            let target_path = assets_path.join("objects").join(&hash[..2]).join(&hash);
            let name_clone = name.clone(); // Clone name for the async block
            let task_counter_clone = Arc::clone(&task_counter);
            let completed_counter_clone = Arc::clone(&completed_counter);
            let total_to_download_clone = Arc::clone(&total_to_download);

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
            total_to_download_clone.fetch_add(1, Ordering::SeqCst);

            downloads.push(async move {
                let task_id = task_counter_clone.fetch_add(1, Ordering::SeqCst);
                trace!(
                    "[Assets Download Task {}] Starting download for: {}",
                    task_id,
                    name_clone
                );
                let url = format!(
                    "https://resources.download.minecraft.net/{}/{}",
                    &hash[..2],
                    hash
                );

                let response_result = reqwest::get(&url).await;

                let response = match response_result {
                    Ok(resp) => resp,
                    Err(e) => {
                        error!(
                            "[Assets Download Task {}] Request error for {}: {}",
                            task_id, name_clone, e
                        );
                        return Err(AppError::Download(format!(
                            "Failed to initiate download for asset {}: {}",
                            name_clone, e
                        )));
                    }
                };

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "No error details available".to_string());
                    error!(
                        "[Assets Download Task {}] Failed download for {}: Status {}, Error: {}",
                        task_id, name_clone, status, error_text
                    );
                    return Err(AppError::Download(format!(
                        "Failed to download asset {} - Status {}: {}",
                        name_clone, status, error_text
                    )));
                }

                let bytes_result = response.bytes().await;
                let bytes = match bytes_result {
                    Ok(b) => b,
                    Err(e) => {
                        error!(
                            "[Assets Download Task {}] Error reading bytes for {}: {}",
                            task_id, name_clone, e
                        );
                        return Err(AppError::Download(format!(
                            "Failed to read bytes for asset {}: {}",
                            name_clone, e
                        )));
                    }
                };

                if let Some(parent) = target_path.parent() {
                    if let Err(e) = fs::create_dir_all(parent).await {
                        error!(
                            "[Assets Download Task {}] Error creating directory for {}: {}",
                            task_id, name_clone, e
                        );
                        return Err(AppError::Io(e));
                    }
                }

                let file_result = fs::File::create(&target_path).await;
                let mut file = match file_result {
                    Ok(f) => f,
                    Err(e) => {
                        error!(
                            "[Assets Download Task {}] Error creating file for {}: {}",
                            task_id, name_clone, e
                        );
                        return Err(AppError::Io(e));
                    }
                };

                if let Err(e) = file.write_all(&bytes).await {
                    error!(
                        "[Assets Download Task {}] Error writing file for {}: {}",
                        task_id, name_clone, e
                    );
                    return Err(AppError::Io(e));
                }

                // Increment completed counter
                let completed = completed_counter_clone.fetch_add(1, Ordering::SeqCst) + 1;
                let total = total_to_download_clone.load(Ordering::SeqCst);

                info!(
                    "[Assets Download Task {}] Finished download for: {} ({}/{})",
                    task_id, name_clone, completed, total
                );
                Ok(())
            });
        }

        info!(
            "[Assets Download] Queued {} actual download tasks.",
            job_count
        );

        if job_count == 0 {
            info!("[Assets Download] No downloads needed, all assets already exist with correct sizes");

            // Final progress event
            self.emit_progress_event(
                &state,
                profile_id,
                "All Minecraft assets already up to date!",
                1.0,
                None,
            )
            .await?;

            return Ok(());
        }

        info!(
            "[Assets Download] Processing tasks with {} concurrent downloads...",
            self.concurrent_downloads
        );

        // Create progress tracking event
        if job_count > 0 {
            self.emit_progress_event(
                &state,
                profile_id,
                &format!("Downloading {} Minecraft assets...", job_count),
                0.2,
                None,
            )
            .await?;
        }

        let results: Vec<Result<()>> = iter(downloads)
            .buffer_unordered(self.concurrent_downloads)
            .inspect(|_| {
                // Update progress after each download completes
                let completed = completed_counter.fetch_add(0, Ordering::SeqCst); // Just read current value
                let total = total_to_download.load(Ordering::SeqCst);

                // Report progress every time
                if total > 0 {
                    // Calculate progress from 0.2 to 0.9
                    let progress = 0.2 + 0.7 * (completed as f64 / total as f64);

                    // Create a separate task for the event to avoid lifetime issues
                    tokio::spawn({
                        let state_clone = state.clone();
                        let message =
                            format!("Downloading Minecraft assets: {}/{}", completed, total);

                        async move {
                            let event_id = Uuid::new_v4();
                            if let Err(e) = state_clone
                                .emit_event(EventPayload {
                                    event_id,
                                    event_type: EventType::DownloadingAssets,
                                    target_id: Some(profile_id),
                                    message,
                                    progress: Some(progress),
                                    error: None,
                                })
                                .await
                            {
                                error!("[Assets Download] Failed to emit progress event: {}", e);
                            }
                        }
                    });
                }
            })
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

            // Emit error event
            self.emit_progress_event(
                &state,
                profile_id,
                &format!("Asset download completed with {} errors", errors.len()),
                0.9,
                Some(errors[0].to_string()),
            )
            .await?;

            // Return the first error encountered to signal failure
            Err(errors.remove(0))
        } else {
            info!("[Assets Download] All asset downloads completed successfully.");

            // Final progress event
            self.emit_progress_event(
                &state,
                profile_id,
                "Minecraft assets download completed successfully!",
                1.0,
                None,
            )
            .await?;

            Ok(())
        }
    }

    /// Wrapper method to maintain compatibility with existing calls
    pub async fn download_assets(&self, asset_index: &AssetIndex) -> Result<()> {
        self.download_assets_with_progress(asset_index, Uuid::nil())
            .await
    }

    async fn download_asset_index(&self, asset_index: &AssetIndex) -> Result<AssetIndexContent> {
        let index_path = self
            .assets_path
            .join("indexes")
            .join(format!("{}.json", asset_index.id));

        // Check if index file exists and size matches
        if fs::try_exists(&index_path).await? {
            if let Ok(metadata) = fs::metadata(&index_path).await {
                if metadata.len() as i64 == asset_index.size {
                    info!(
                        "[Assets Download] Asset index {} already exists with correct size.",
                        asset_index.id
                    );
                    let content = fs::read(&index_path).await?;
                    return Ok(serde_json::from_slice(&content)?);
                }
                warn!("[Assets Download] Asset index {} exists but size mismatch (expected {}, got {}), redownloading.", asset_index.id, asset_index.size, metadata.len());
            }
        }

        info!(
            "[Assets Download] Downloading asset index: {}",
            asset_index.id
        );
        let response_result = reqwest::get(&asset_index.url).await;
        let response = match response_result {
            Ok(resp) => resp,
            Err(e) => {
                error!(
                    "[Assets Download] Failed request for asset index {}: {}",
                    asset_index.id, e
                );
                return Err(AppError::Download(format!(
                    "Failed to download asset index {}: {}",
                    asset_index.id, e
                )));
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "No error details available".to_string());
            error!(
                "[Assets Download] Failed response for asset index {}: Status {}, Error: {}",
                asset_index.id, status, error_text
            );
            return Err(AppError::Download(format!(
                "Failed to download asset index {} - Status {}: {}",
                asset_index.id, status, error_text
            )));
        }

        let bytes_result = response.bytes().await;
        let bytes = match bytes_result {
            Ok(b) => b,
            Err(e) => {
                error!(
                    "[Assets Download] Failed reading bytes for asset index {}: {}",
                    asset_index.id, e
                );
                return Err(AppError::Download(format!(
                    "Failed to read bytes for asset index {}: {}",
                    asset_index.id, e
                )));
            }
        };

        // Ensure parent directory exists
        if let Some(parent) = index_path.parent() {
            if let Err(e) = fs::create_dir_all(parent).await {
                error!(
                    "[Assets Download] Failed creating directory for asset index {}: {}",
                    asset_index.id, e
                );
                return Err(AppError::Io(e));
            }
        }

        // Write the index file
        let file_result = fs::File::create(&index_path).await;
        let mut file = match file_result {
            Ok(f) => f,
            Err(e) => {
                error!(
                    "[Assets Download] Failed creating file for asset index {}: {}",
                    asset_index.id, e
                );
                return Err(AppError::Io(e));
            }
        };

        if let Err(e) = file.write_all(&bytes).await {
            error!(
                "[Assets Download] Failed writing file for asset index {}: {}",
                asset_index.id, e
            );
            return Err(AppError::Io(e));
        }

        info!(
            "[Assets Download] Successfully downloaded asset index: {}",
            asset_index.id
        );

        Ok(serde_json::from_slice(&bytes)?)
    }

    /// Helper method for emitting progress events
    async fn emit_progress_event(
        &self,
        state: &State,
        profile_id: Uuid,
        message: &str,
        progress: f64,
        error: Option<String>,
    ) -> Result<Uuid> {
        let event_id = Uuid::new_v4();
        state
            .emit_event(EventPayload {
                event_id,
                event_type: EventType::DownloadingAssets,
                target_id: Some(profile_id),
                message: message.to_string(),
                progress: Some(progress),
                error,
            })
            .await?;
        Ok(event_id)
    }
}
