use crate::error::{AppError, Result};
use crate::minecraft::dto::norisk_meta::NoriskAssets;
use crate::minecraft::dto::piston_meta::AssetObject;
use crate::minecraft::api::NoRiskApi;
use crate::config::{ProjectDirsExt, HTTP_CLIENT, LAUNCHER_DIRECTORY};
use crate::state::profile_state::Profile;
use crate::minecraft::auth::minecraft_auth::Credentials;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use reqwest;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use futures::stream::{StreamExt, iter};
use log::{info, error, debug, warn, trace};
use std::collections::HashMap;

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

        // Fetch assets JSON from NoRisk API
        info!("[NRC Assets Download] Fetching assets for branch: {} (experimental mode: {})", pack, is_experimental);
        let assets = NoRiskApi::norisk_assets(&pack, &norisk_token, &request_uuid, is_experimental).await?;
        info!("[NRC Assets Download] Assets fetched successfully");
        if let Some((key, obj)) = assets.objects.iter().next() {
            info!("[NRC Assets Download] Sample asset - Key: {}, Hash: {}, Size: {}", key, obj.hash, obj.size);
        } else {
            info!("[NRC Assets Download] No assets found in the response");
        }
        
        // Download the assets
        self.download_nrc_assets(&pack, &assets, is_experimental, &norisk_token).await
    }

    /// Downloads NoRisk client assets for a specific branch
    pub async fn download_nrc_assets(&self, pack: &str, assets: &NoriskAssets, is_experimental: bool, norisk_token: &str) -> Result<()> {
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

        trace!("[NRC Assets Download] Preparing {} potential jobs...", assets_list.len());
        let mut job_count = 0;
        
        for (name, asset) in assets_list {
            let hash = asset.hash.clone();
            let size = asset.size;
            let target_path = assets_path.join(&name);
            let name_clone = name.clone(); // Clone name for the async block
            let task_counter_clone = Arc::clone(&task_counter);
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

                info!("[NRC Assets Download Task {}] Finished download for: {}", task_id, name_clone);
                Ok(())
            });
        }
        
        info!("[NRC Assets Download] Queued {} actual download tasks.", job_count);

        if job_count == 0 {
            info!("[NRC Assets Download] No new assets to download, all assets are up to date.");
            return Ok(());
        }

        info!("[NRC Assets Download] Processing tasks with {} concurrent downloads...", self.concurrent_downloads);
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
            error!("[NRC Assets Download] Finished with {} errors:", errors.len());
            for error_item in &errors {
                error!("  - {}", error_item);
            }
            // Return the first error encountered to signal failure
            Err(errors.remove(0))
        } else {
            info!("[NRC Assets Download] All asset downloads completed successfully.");
            Ok(())
        }
    }
} 