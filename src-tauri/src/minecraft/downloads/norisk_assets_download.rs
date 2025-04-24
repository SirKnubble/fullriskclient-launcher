use crate::error::{AppError, Result};
use crate::minecraft::dto::norisk_meta::NoriskAssets;
use crate::minecraft::dto::piston_meta::AssetObject;
use crate::minecraft::api::NoRiskApi;
use crate::config::{ProjectDirsExt, HTTP_CLIENT, LAUNCHER_DIRECTORY};
use crate::state::profile_state::Profile;
use crate::minecraft::auth::minecraft_auth::Credentials;
use crate::state::State;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use reqwest;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use futures::stream::{StreamExt, iter};
use log::{info, error, debug, warn, trace};
use std::collections::HashMap;
use crate::state::event_state::{EventPayload, EventType};
use uuid::Uuid;

const ASSETS_DIR: &str = "assets";
const NORISK_ASSETS_DIR: &str = "noriskclient";
const DEFAULT_CONCURRENT_DOWNLOADS: usize = 12;
const DEFAULT_BRANCH: &str = "prod"; // Default branch if none specified

pub struct NoriskClientAssetsDownloadService {
    base_path: PathBuf,
    concurrent_downloads: usize,
}

impl NoriskClientAssetsDownloadService {
    pub fn new() -> Self {
        let base_path = LAUNCHER_DIRECTORY.meta_dir().join(ASSETS_DIR);
        info!("[NRC Assets Service] Initialized. Base Path: {}", base_path.display());
        Self {
            base_path,
            concurrent_downloads: DEFAULT_CONCURRENT_DOWNLOADS,
        }
    }

    /// Sets the number of concurrent downloads to use
    pub fn with_concurrent_downloads(mut self, concurrent_downloads: usize) -> Self {
        self.concurrent_downloads = concurrent_downloads;
        self
    }

    /// Downloads NoRisk client assets for a specific profile
    pub async fn download_nrc_assets_for_profile(
        &self, 
        profile: &Profile, 
        credentials: Option<&Credentials>,
        is_experimental: bool
    ) -> Result<()> {
        // Get branch from profile's pack, or use default
        let state = State::get().await?;
        let game_directory = state.profile_manager.calculate_instance_path_for_profile(profile)?;

        let pack = match &profile.selected_norisk_pack_id {
            Some(pack_id) if !pack_id.is_empty() => {
                info!("[NRC Assets Download] Using pack ID from profile: {}", pack_id);
                pack_id.clone()
            },
            _ => {
                info!("[NRC Assets Download] No pack specified in profile, skipping asset download");
                return Ok(());
            }
        };

        // Check if we have credentials
        let creds = match credentials {
            Some(c) => c,
            None => {
                warn!("[NRC Assets Download] No credentials provided, skipping asset download");
                return Ok(());
            }
        };

        // Get the correct token based on experimental mode
        let token_ref = if is_experimental {
            info!("[NRC Assets Download] Using experimental token");
            &creds.norisk_credentials.experimental
        } else {
            info!("[NRC Assets Download] Using production token");
            &creds.norisk_credentials.production
        };

        let norisk_token = match token_ref {
            Some(token) => token.value.clone(),
            None => {
                warn!("[NRC Assets Download] No valid NoRisk token found for {} mode, skipping asset download", 
                      if is_experimental { "experimental" } else { "production" });
                return Ok(());
            }
        };

        // Use the credentials UUID as request UUID
        let request_uuid = creds.id.to_string();
        info!("[NRC Assets Download] Using request UUID from credentials: {}", request_uuid);

        // Emit initial event
        self.emit_progress_event(
            &state,
            profile.id,
            "Fetching NoRisk assets information...",
            0.05,
            None
        ).await?;

        // Fetch assets JSON from NoRisk API
        info!("[NRC Assets Download] Fetching assets for branch: {} (experimental mode: {})", pack, is_experimental);
        let assets = NoRiskApi::norisk_assets(&pack, &norisk_token, &request_uuid, is_experimental).await?;
        info!("[NRC Assets Download] Assets fetched successfully");
        if let Some((key, obj)) = assets.objects.iter().next() {
            info!("[NRC Assets Download] Sample asset - Key: {}, Hash: {}, Size: {}", key, obj.hash, obj.size);
        } else {
            info!("[NRC Assets Download] No assets found in the response");
        }
        
        // Emit progress event after fetching assets
        self.emit_progress_event(
            &state,
            profile.id,
            &format!("Found {} assets to download", assets.objects.len()),
            0.1,
            None
        ).await?;
        
        // Download the assets
        self.download_nrc_assets(&pack, &assets, is_experimental, &norisk_token, Some(profile.id)).await?;
        
        // Copy assets to profile's game directory
        info!("[NRC Assets Download] Copying assets to game directory: {:?}", game_directory);
        self.emit_progress_event(
            &state,
            profile.id,
            "Copying assets to game directory...",
            0.9,
            None
        ).await?;
        
        self.copy_assets_to_game_dir(&pack, &assets, game_directory).await?;
        
        // Final progress update
        self.emit_progress_event(
            &state,
            profile.id,
            "NoRiskClient assets download and installation completed!",
            1.0,
            None
        ).await?;
       
        Ok(())
    }

    /// Downloads NoRisk client assets for a specific branch
    pub async fn download_nrc_assets(
        &self, 
        pack: &str, 
        assets: &NoriskAssets, 
        is_experimental: bool, 
        norisk_token: &str,
        profile_id: Option<Uuid>
    ) -> Result<()> {
        trace!("[NRC Assets Download] Starting download process for branch: {}", pack);
        
        let assets_path = self.base_path.join(NORISK_ASSETS_DIR).join(pack);
        if !fs::try_exists(&assets_path).await? {
            fs::create_dir_all(&assets_path).await?;
            info!("[NRC Assets Download] Created directory: {}", assets_path.display());
        }

        let assets_list: Vec<(String, AssetObject)> = assets.objects.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
            
        let mut downloads = Vec::new();
        let task_counter = Arc::new(AtomicUsize::new(1)); // Start counter at 1
        let total_assets = assets_list.len();
        let completed_counter = Arc::new(AtomicUsize::new(0));
        let total_to_download = Arc::new(AtomicUsize::new(0));

        trace!("[NRC Assets Download] Preparing {} potential jobs...", assets_list.len());
        let mut job_count = 0;
        
        // Get state for progress events if we have a profile ID
        let state = if profile_id.is_some() {
            Some(State::get().await?)
        } else {
            None
        };
        
        for (name, asset) in assets_list {
            let hash = asset.hash.clone();
            let size = asset.size;
            let target_path = assets_path.join(&name);
            let name_clone = name.clone(); // Clone name for the async block
            let task_counter_clone = Arc::clone(&task_counter);
            let completed_counter_clone = Arc::clone(&completed_counter);
            let total_to_download_clone = Arc::clone(&total_to_download);
            let pack_clone = pack.to_string();
            let norisk_token_clone = norisk_token.to_string();

            // Check if asset exists and size matches
            if fs::try_exists(&target_path).await? {
                if let Ok(metadata) = fs::metadata(&target_path).await {
                    if metadata.len() as i64 == size {
                        trace!("[NRC Assets Download] Skipping asset {} (already exists with correct size)", name_clone);
                        continue; // Skip this asset
                    }
                    warn!("[NRC Assets Download] Asset {} exists but size mismatch (expected {}, got {}), redownloading.",
                         name_clone, size, metadata.len());
                }
            }

            job_count += 1;
            total_to_download_clone.fetch_add(1, Ordering::SeqCst);
            downloads.push(async move {
                let task_id = task_counter_clone.fetch_add(1, Ordering::SeqCst);
                trace!("[NRC Assets Download Task {}] Starting download for: {}", task_id, name_clone);
                
                // Determine prod/exp mode
                let prod_or_exp = if is_experimental {
                    "exp"
                } else {
                    "prod"
                };
                
                // Use the NoRisk API to get assets with the correct URL structure
                let url = format!(
                    "{}/{}/{}/assets/{}",
                    "https://cdn.norisk.gg/branches", prod_or_exp, pack_clone, name_clone
                );

                let mut request = HTTP_CLIENT.get(&url);
                
                // Add authorization with the actual token
                request = request.header("Authorization", format!("Bearer {}", norisk_token_clone));

                let response_result = request.send().await;
                let response = match response_result {
                    Ok(resp) => resp,
                    Err(e) => {
                        error!("[NRC Assets Download Task {}] Request error for {}: {}", task_id, name_clone, e);
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
                    error!("[NRC Assets Download Task {}] Failed download for {}: Status {}, Error: {}", 
                           task_id, name_clone, status, error_text);
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
                         error!("[NRC Assets Download Task {}] Error reading bytes for {}: {}", task_id, name_clone, e);
                         return Err(AppError::Download(format!(
                            "Failed to read bytes for asset {}: {}",
                            name_clone,
                            e
                        )));
                    }
                };

                if let Some(parent) = target_path.parent() {
                    if let Err(e) = fs::create_dir_all(parent).await {
                        error!("[NRC Assets Download Task {}] Error creating directory for {}: {}", task_id, name_clone, e);
                         return Err(AppError::Io(e));
                    }
                }

                let file_result = fs::File::create(&target_path).await;
                let mut file = match file_result {
                    Ok(f) => f,
                    Err(e) => {
                        error!("[NRC Assets Download Task {}] Error creating file for {}: {}", task_id, name_clone, e);
                         return Err(AppError::Io(e));
                    }
                };

                if let Err(e) = file.write_all(&bytes).await {
                    error!("[NRC Assets Download Task {}] Error writing file for {}: {}", task_id, name_clone, e);
                     return Err(AppError::Io(e));
                }

                // Increment completed counter and update progress
                let completed = completed_counter_clone.fetch_add(1, Ordering::SeqCst) + 1;
                let total = total_to_download_clone.load(Ordering::SeqCst);
                
                info!("[NRC Assets Download Task {}] Finished download for: {} ({}/{})", 
                      task_id, name_clone, completed, total);
                Ok(())
            });
        }
        
        info!("[NRC Assets Download] Queued {} actual download tasks.", job_count);

        if job_count == 0 {
            info!("[NRC Assets Download] No new assets to download, all assets are up to date.");
            
            // Update progress if we have a profile ID
            if let (Some(state_ref), Some(profile_id_val)) = (&state, profile_id) {
                self.emit_progress_event(
                    state_ref,
                    profile_id_val,
                    "All NoRiskClient assets are up to date!",
                    0.8,
                    None
                ).await?;
            }
            
            return Ok(());
        }

        info!("[NRC Assets Download] Processing tasks with {} concurrent downloads...", self.concurrent_downloads);
        
        // Setup progress reporting
        let total_downloads = job_count;
        let completed_ref = Arc::clone(&completed_counter);
        
        // Start a task to track progress and emit events
        if let (Some(state_ref), Some(profile_id_val)) = (&state, profile_id) {
            // No need to store anything, we'll access state and profile_id directly in the inspect callback
        }
        
        let results: Vec<Result<()>> = iter(downloads)
            .buffer_unordered(self.concurrent_downloads)
            .inspect(|_| {
                // Update progress after each download completes
                let completed = completed_ref.load(Ordering::SeqCst); // Just read the current value
                let total = total_to_download.load(Ordering::SeqCst);
                
                // Emit progress event every 10 completed downloads or when total changes significantly
                if total > 0 && profile_id.is_some() {
                    if let (Some(state_ref), Some(profile_id_val)) = (&state, profile_id) {
                        // Calculate progress from 0.1 to 0.9 (leaving room for pre and post tasks)
                        let progress = 0.1 + (completed as f64 / total as f64) * 0.8;
                        
                        // Creating a separate task that doesn't capture self
                        tokio::spawn({
                            let state = state_ref.clone();
                            let message = format!("Downloading NoRiskClient assets: {}/{} files", completed, total);
                            let profile_id = profile_id_val;
                            
                            async move {
                                let event_id = Uuid::new_v4();
                                if let Err(e) = state.emit_event(EventPayload {
                                    event_id,
                                    event_type: EventType::DownloadingNoRiskClientAssets,
                                    target_id: Some(profile_id),
                                    message,
                                    progress: Some(progress),
                                    error: None,
                                }).await {
                                    error!("[NRC Assets Download] Failed to emit progress event: {}", e);
                                }
                            }
                        });
                    }
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
            error!("[NRC Assets Download] Finished with {} errors:", errors.len());
            for error_item in &errors {
                error!("  - {}", error_item);
            }
            
            // Emit error event if we have a profile ID
            if let (Some(state_ref), Some(profile_id_val)) = (&state, profile_id) {
                self.emit_progress_event(
                    state_ref,
                    profile_id_val,
                    &format!("Failed to download some NoRiskClient assets ({} errors)", errors.len()),
                    0.8,
                    Some(errors[0].to_string())
                ).await?;
            }
            
            // Return the first error encountered to signal failure
            Err(errors.remove(0))
        } else {
            info!("[NRC Assets Download] All asset downloads completed successfully.");
            
            // Final progress update if we have a profile ID
            if let (Some(state_ref), Some(profile_id_val)) = (&state, profile_id) {
                self.emit_progress_event(
                    state_ref,
                    profile_id_val,
                    "NoRiskClient assets download completed!",
                    0.8,
                    None
                ).await?;
            }
            
            Ok(())
        }
    }

    /// Helper method to emit progress events
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
                event_type: EventType::DownloadingNoRiskClientAssets,
                target_id: Some(profile_id),
                message: message.to_string(),
                progress: Some(progress),
                error,
            })
            .await?;
        Ok(event_id)
    }

    /// Copy downloaded assets to the profile's game directory
    pub async fn copy_assets_to_game_dir(&self, pack: &str, assets: &NoriskAssets, game_dir: PathBuf) -> Result<()> {
        let source_dir = self.base_path.join(NORISK_ASSETS_DIR).join(pack);
        let target_dir = game_dir.join("NoRiskClient").join("assets");
        
        info!("[NRC Assets Copy] Copying assets from {} to {}", source_dir.display(), target_dir.display());
        
        // Ensure target directory exists
        if !fs::try_exists(&target_dir).await? {
            fs::create_dir_all(&target_dir).await?;
            info!("[NRC Assets Copy] Created target directory: {}", target_dir.display());
        }
        
        let assets_list: Vec<(String, AssetObject)> = assets.objects.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
            
        let mut copied_count = 0;
        let mut skipped_count = 0;
        
        for (name, asset) in assets_list {
            let source_path = source_dir.join(&name);
            let target_path = target_dir.join(&name);
            
            // Skip if the file doesn't exist in source
            if !fs::try_exists(&source_path).await? {
                warn!("[NRC Assets Copy] Source file doesn't exist: {}", source_path.display());
                continue;
            }
            
            // Check if file already exists in target with correct size
            let needs_copy = if fs::try_exists(&target_path).await? {
                let source_metadata = fs::metadata(&source_path).await?;
                let target_metadata = fs::metadata(&target_path).await?;
                
                if source_metadata.len() != target_metadata.len() {
                    debug!("[NRC Assets Copy] Size mismatch for {}, needs copy", name);
                    true
                } else {
                    // Files exist with same size, skip copy
                    trace!("[NRC Assets Copy] Skipping {}, already exists with same size", name);
                    false
                }
            } else {
                // Target doesn't exist, needs copy
                debug!("[NRC Assets Copy] Target doesn't exist for {}, needs copy", name);
                true
            };
            
            if needs_copy {
                // Ensure parent directory exists
                if let Some(parent) = target_path.parent() {
                    if !fs::try_exists(parent).await? {
                        fs::create_dir_all(parent).await?;
                    }
                }
                
                // Copy the file
                fs::copy(&source_path, &target_path).await?;
                copied_count += 1;
                
                if copied_count % 100 == 0 {
                    info!("[NRC Assets Copy] Copied {} files so far...", copied_count);
                }
            } else {
                skipped_count += 1;
            }
        }
        
        info!("[NRC Assets Copy] Completed copying assets. Copied: {}, Skipped: {}", copied_count, skipped_count);
        Ok(())
    }
} 