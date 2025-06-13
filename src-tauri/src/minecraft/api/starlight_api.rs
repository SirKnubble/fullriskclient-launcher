use crate::config::{ProjectDirsExt, HTTP_CLIENT, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::state::event_state::{EventPayload, EventType};
use crate::utils::hash_utils::calculate_sha1_from_bytes;
use log::{debug, error, warn};
use reqwest;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs as tokio_fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

const STARLIGHT_API_BASE: &str = "https://starlightskins.lunareclipse.studio";

fn generate_cache_filename(
    player_name: &str,
    render_type: &str,
    render_view: &str,
    base64_skin_data: Option<&str>,
) -> String {
    if let Some(data) = base64_skin_data {
        let hash_string = calculate_sha1_from_bytes(data.as_bytes());
        let short_hash = &hash_string[0..std::cmp::min(8, hash_string.len())];
        format!(
            "{}_{}_{}_custom_{}.png",
            player_name, render_type, render_view, short_hash
        )
    } else {
        format!(
            "{}_{}_{}_default.png",
            player_name, render_type, render_view
        )
    }
}

pub struct StarlightApiService {
    cache_dir: PathBuf,
}

impl StarlightApiService {
    pub fn new() -> Result<Self> {
        let cache_dir = LAUNCHER_DIRECTORY.meta_dir().join("starlight_cache");
        if !cache_dir.exists() {
            std::fs::create_dir_all(&cache_dir).map_err(|e| {
                AppError::Other(format!("Failed to create Starlight cache directory: {}", e))
            })?;
        }
        Ok(Self { cache_dir })
    }

    async fn fetch_and_cache_skin(
        player_name: &str,
        render_type: &str,
        render_view: &str,
        base64_skin_data: Option<&str>,
        target_cache_path: &PathBuf,
    ) -> Result<Vec<u8>> {
        let base_url = format!(
            "{}/render/{}/{}/{}",
            STARLIGHT_API_BASE, render_type, player_name, render_view
        );

        let mut query_params = Vec::new();
        if let Some(data) = base64_skin_data {
            let data_uri = format!("data:image/png;base64,{}", data);
            // It's highly recommended to URL-encode data_uri here.
            // Example with urlencoding crate: query_params.push(("skinUrl", urlencoding::encode(&data_uri).into_owned()));
            query_params.push(("skinUrl", data_uri)); // Simplified for now
        }

        // Use global HTTP_CLIENT
        let mut request_builder = HTTP_CLIENT.get(&base_url);
        if !query_params.is_empty() {
            request_builder = request_builder.query(&query_params);
        }

        let request = request_builder.build().map_err(|e| {
            error!("Failed to build Starlight API request: {}", e);
            AppError::Other(format!("Failed to build Starlight API request: {}", e))
        })?;

        let final_url = request.url().to_string(); // Get URL from the built request for logging

        debug!(
            "Fetching skin render from URL: {} for player {} (type: {}, view: {}, custom_skin: {})",
            final_url, // Log the final URL with query params
            player_name,
            render_type,
            render_view,
            base64_skin_data.is_some()
        );

        // Use global HTTP_CLIENT to execute the request
        let response = HTTP_CLIENT.execute(request).await.map_err(|e| {
            warn!(
                "Starlight API request failed for player {} (type: {}, view: {}, custom_skin: {}): {:?}",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some(),
                e
            );
            AppError::Other(format!("Starlight API request failed: {}", e))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| format!("HTTP Error {}", status));
            warn!(
                "Starlight API call failed for player {} (type: {}, view: {}, custom_skin: {}) with status {}: {}",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some(),
                status,
                error_text
            );
            return Err(AppError::Other(format!(
                "Failed to fetch skin render for '{}' (type: {}, view: {}, custom_skin: {}): {}",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some(),
                if status == 404 {
                    "Render not found".to_string()
                } else {
                    error_text
                }
            )));
        }

        let image_bytes = response.bytes().await.map_err(|e| {
            warn!(
                "Failed to read image bytes for player {} (type: {}, view: {}, custom_skin: {}): {:?}",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some(),
                e
            );
            AppError::Other(format!(
                "Failed to read image bytes for {}: {}",
                player_name,
                e
            ))
        })?;

        debug!(
            "Saving skin render for player {} (type: {}, view: {}, custom_skin: {}) to cache: {:?}",
            player_name,
            render_type,
            render_view,
            base64_skin_data.is_some(),
            target_cache_path
        );
        let mut file = tokio_fs::File::create(&target_cache_path).await.map_err(|e| {
            error!(
                "Failed to create cache file for player {} (type: {}, view: {}, custom_skin: {}): {:?}",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some(),
                e
            );
            AppError::Other(format!(
                "Failed to create cache file {}: {}",
                target_cache_path.display(),
                e
            ))
        })?;

        file.write_all(&image_bytes).await.map_err(|e| {
            error!(
                "Failed to write image to cache file for player {} (type: {}, view: {}, custom_skin: {}): {:?}",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some(),
                e
            );
            AppError::Other(format!(
                "Failed to write image to cache file {}: {}",
                target_cache_path.display(),
                e
            ))
        })?;

        debug!(
            "Successfully cached skin render for player {} (type: {}, view: {}, custom_skin: {}): {:?}",
            player_name,
            render_type,
            render_view,
            base64_skin_data.is_some(),
            target_cache_path
        );
        Ok(image_bytes.to_vec())
    }

    async fn background_skin_update(
        cache_dir: PathBuf,
        player_name: String,
        render_type: String,
        render_view: String,
        base64_skin_data: Option<String>,
    ) {
        let file_name = generate_cache_filename(
            &player_name,
            &render_type,
            &render_view,
            base64_skin_data.as_deref(),
        );
        let cache_path = cache_dir.join(&file_name);

        debug!(
            "[BG] Attempting to update skin for player {} (type: {}, view: {}, custom_skin: {}) at {:?}",
            player_name,
            render_type,
            render_view,
            base64_skin_data.is_some(),
            cache_path
        );

        match Self::fetch_and_cache_skin(
            &player_name,
            &render_type,
            &render_view,
            base64_skin_data.as_deref(),
            &cache_path,
        )
        .await
        {
            Ok(_new_image_bytes) => {
                debug!(
                    "[BG] Skin for player {} (type: {}, view: {}, custom_skin: {}) successfully fetched and cached. Emitting update event.",
                    player_name,
                    render_type,
                    render_view,
                    base64_skin_data.is_some()
                );

                if let Ok(state) = crate::state::State::get().await {
                    let skin_type_msg = if base64_skin_data.is_some() {
                        "custom skin"
                    } else {
                        "default skin"
                    };
                    let payload = EventPayload {
                        event_id: Uuid::new_v4(),
                        event_type: EventType::StarlightSkinUpdated,
                        target_id: None,
                        message: format!(
                            "Skin for player {} (type: {}, view: {}, {}) was updated.",
                            player_name, render_type, render_view, skin_type_msg
                        ),
                        progress: None,
                        error: None,
                    };
                    if let Err(e) = state.event_state.emit(payload).await {
                        error!(
                            "[BG] Failed to emit StarlightSkinUpdated event for {} (type: {}, view: {}, custom_skin: {}): {}",
                            player_name,
                            render_type,
                            render_view,
                            base64_skin_data.is_some(),
                            e
                        );
                    }
                } else {
                    error!("[BG] Failed to get global state to emit StarlightSkinUpdated event for {}.", player_name);
                }
            }
            Err(e) => {
                warn!(
                    "[BG] Failed to fetch and cache skin for player {} (type: {}, view: {}, custom_skin: {}): {}. No event will be emitted.",
                    player_name,
                    render_type,
                    render_view,
                    base64_skin_data.is_some(),
                    e
                );
            }
        }
    }

    pub async fn get_skin_render(
        &self,
        player_name: &str,
        render_type: &str,
        render_view: &str,
        base64_skin_data: Option<String>,
    ) -> Result<PathBuf> {
        debug!(
            "Requesting skin render for player: {} (type: {}, view: {}, custom_skin: {})",
            player_name,
            render_type,
            render_view,
            base64_skin_data.is_some()
        );

        let file_name = generate_cache_filename(
            player_name,
            render_type,
            render_view,
            base64_skin_data.as_deref(),
        );
        let cache_path = self.cache_dir.join(&file_name);

        if cache_path.exists() {
            if base64_skin_data.is_some() {
                // Custom skin data provided and cache exists for this specific custom skin.
                // Assume it hasn't changed, so return directly without background update.
                debug!(
                    "Cache hit for custom skin data for player {} (type: {}, view: {}): {:?}. Returning cached path without background update.",
                    player_name, render_type, render_view, cache_path
                );
                Ok(cache_path)
            } else {
                // No custom skin data provided (it's None), but cache exists (for player_name default skin).
                // Return cached path and spawn background update as usual, as default skin might change.
                debug!(
                    "Cache hit for default skin for player {} (type: {}, view: {}): {:?}. Returning cached path and spawning background update.",
                    player_name, render_type, render_view, cache_path
                );

                let cache_dir_clone = self.cache_dir.clone();
                let player_name_clone = player_name.to_string();
                let render_type_clone = render_type.to_string();
                let render_view_clone = render_view.to_string();
                // base64_skin_data is None in this branch, so cloning it as None is fine for background_skin_update signature.
                let base64_skin_data_clone = base64_skin_data.clone();

                tokio::spawn(async move {
                    Self::background_skin_update(
                        cache_dir_clone,
                        player_name_clone,
                        render_type_clone,
                        render_view_clone,
                        base64_skin_data_clone, // This will be None
                    )
                    .await;
                });
                Ok(cache_path)
            }
        } else {
            // Cache miss, fetch and cache in foreground.
            debug!(
                "Cache miss for player {} (type: {}, view: {}, custom_skin: {}). Fetching and caching in foreground.",
                player_name,
                render_type,
                render_view,
                base64_skin_data.is_some()
            );
            match Self::fetch_and_cache_skin(
                player_name,
                render_type,
                render_view,
                base64_skin_data.as_deref(), // Pass as Option<&str>
                &cache_path,
            )
            .await
            {
                Ok(_) => Ok(cache_path),
                Err(e) => {
                    error!(
                        "Failed to fetch skin for player {} (type: {}, view: {}, custom_skin: {}) in foreground: {}",
                        player_name,
                        render_type,
                        render_view,
                        base64_skin_data.is_some(),
                        e
                    );
                    Err(e)
                }
            }
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct GetSkinRenderPayload {
    pub player_name: String,
    pub render_type: String,
    pub render_view: String,
    pub base64_skin_data: Option<String>,
}
