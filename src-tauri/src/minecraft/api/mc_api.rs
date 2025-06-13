use crate::error::{AppError, Result};
use crate::minecraft::dto::minecraft_profile::MinecraftProfile;
use crate::minecraft::dto::piston_meta::PistonMeta;
use crate::minecraft::dto::version_manifest::VersionManifest;
use log::debug;
use reqwest;
use serde_json::Value;
use std::fs;
use std::path::Path;
use uuid::Uuid;

const VERSION_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const MOJANG_API_URL: &str = "https://api.mojang.com";
const MOJANG_SESSION_URL: &str = "https://sessionserver.mojang.com";

pub struct MinecraftApiService;

impl MinecraftApiService {
    pub fn new() -> Self {
        Self
    }

    pub async fn get_version_manifest(&self) -> Result<VersionManifest> {
        let response = reqwest::get(VERSION_MANIFEST_URL)
            .await
            .map_err(AppError::MinecraftApi)?;

        let manifest = response
            .json::<VersionManifest>()
            .await
            .map_err(AppError::MinecraftApi)?;

        Ok(manifest)
    }

    pub async fn get_piston_meta(&self, url: &str) -> Result<PistonMeta> {
        let response = reqwest::get(url).await.map_err(AppError::MinecraftApi)?;

        let meta = response
            .json::<PistonMeta>()
            .await
            .map_err(AppError::MinecraftApi)?;

        Ok(meta)
    }

    // Get user profile including skin information
    pub async fn get_user_profile(&self, uuid: &str) -> Result<MinecraftProfile> {
        debug!("API call: get_user_profile for UUID: {}", uuid);
        let url = format!("{}/session/minecraft/profile/{}", MOJANG_SESSION_URL, uuid);
        debug!("Request URL: {}", url);

        let response = match reqwest::get(&url).await {
            Ok(resp) => {
                debug!("Received response with status: {}", resp.status());
                resp
            }
            Err(e) => {
                debug!("API request failed: {:?}", e);
                return Err(AppError::MinecraftApi(e));
            }
        };

        let profile = match response.json::<MinecraftProfile>().await {
            Ok(p) => {
                debug!("Successfully parsed profile data for UUID: {}", uuid);
                p
            }
            Err(e) => {
                debug!("Failed to parse profile data: {:?}", e);
                return Err(AppError::MinecraftApi(e));
            }
        };

        debug!("API call completed: get_user_profile");
        Ok(profile)
    }

    pub async fn get_profile_by_name_or_uuid(
        &self,
        name_or_uuid_query: &str,
    ) -> Result<MinecraftProfile> {
        debug!(
            "API call: get_profile_by_name_or_uuid for query: {}",
            name_or_uuid_query
        );

        // Check if the query is a valid UUID
        if Uuid::parse_str(name_or_uuid_query).is_ok() {
            debug!("Query is a UUID. Fetching profile directly.");
            return self.get_user_profile(name_or_uuid_query).await;
        }

        // If not a UUID, assume it's a username and try to resolve it
        debug!("Query is likely a username. Attempting to resolve to UUID.");
        let username_lookup_url = format!(
            "{}/users/profiles/minecraft/{}",
            MOJANG_API_URL, name_or_uuid_query
        );
        debug!("Username lookup URL: {}", username_lookup_url);

        let response = reqwest::get(&username_lookup_url).await.map_err(|e| {
            debug!("Failed to call Mojang API for username lookup: {:?}", e);
            AppError::MinecraftApi(e)
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| format!("HTTP Error {}", status));
            debug!(
                "Mojang API username lookup failed with status {}: {}",
                status, error_text
            );
            return Err(AppError::Other(format!(
                "Failed to find player by name '{}': {}",
                name_or_uuid_query,
                if status == 404 {
                    "Player not found".to_string()
                } else {
                    error_text
                }
            )));
        }

        let player_data = response.json::<Value>().await.map_err(|e| {
            debug!(
                "Failed to parse Mojang API response for username lookup: {:?}",
                e
            );
            AppError::MinecraftApi(e)
        })?;

        if let Some(uuid_str) = player_data.get("id").and_then(Value::as_str) {
            debug!("Successfully resolved username to UUID: {}", uuid_str);
            self.get_user_profile(uuid_str).await
        } else {
            debug!(
                "Could not extract UUID from Mojang API response. Response: {:?}",
                player_data
            );
            Err(AppError::Other(format!(
                "Could not find UUID for player name: {}",
                name_or_uuid_query
            )))
        }
    }

    // Change skin using access token (requires authentication)
    pub async fn change_skin(
        &self,
        access_token: &str,
        uuid: &str,
        skin_path: &str,
        skin_variant: &str,
    ) -> Result<()> {
        debug!(
            "API call: change_skin for UUID: {} with variant: {}",
            uuid, skin_variant
        );
        debug!("Skin file path: {}", skin_path);

        let url = format!("https://api.minecraftservices.com/minecraft/profile/skins");
        debug!("Request URL: {}", url);

        // Read skin file as bytes
        debug!("Reading skin file");
        let file_content = match fs::read(skin_path) {
            Ok(content) => {
                debug!("Successfully read skin file ({} bytes)", content.len());
                content
            }
            Err(e) => {
                debug!("Failed to read skin file: {}", e);
                return Err(AppError::Other(format!("Failed to read skin file: {}", e)));
            }
        };

        // Get filename from path
        let filename = Path::new(skin_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("skin.png");
        debug!("Using filename: {}", filename);

        let client = reqwest::Client::new();
        debug!("Creating multipart form with file and variant");

        // Create form with file part and variant part
        let mime_result = reqwest::multipart::Part::bytes(file_content)
            .file_name(filename.to_string())
            .mime_str("image/png");

        if let Err(ref e) = mime_result {
            debug!("Failed to set MIME type: {}", e);
        }

        let form = reqwest::multipart::Form::new()
            .part(
                "file",
                mime_result.map_err(|e| AppError::Other(format!("Invalid MIME type: {}", e)))?,
            )
            .text("variant", skin_variant.to_string());

        debug!("Sending skin upload request to Minecraft API");
        // Send multipart request
        let response_result = client
            .post(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .multipart(form)
            .send()
            .await;

        if let Err(ref e) = response_result {
            debug!("API request failed: {:?}", e);
        }

        let response = response_result.map_err(AppError::MinecraftApi)?;
        debug!("Received response with status: {}", response.status());

        // Check if successful
        if !response.status().is_success() {
            let error_text_result = response.text().await;

            if let Err(ref e) = error_text_result {
                debug!("Failed to read error response: {:?}", e);
            }

            let error_text = error_text_result.map_err(AppError::MinecraftApi)?;
            debug!("Skin upload failed: {}", error_text);
            return Err(AppError::Other(format!(
                "Failed to change skin: {}",
                error_text
            )));
        }

        debug!("API call completed: change_skin - Skin uploaded successfully");
        Ok(())
    }

    // Reset skin to default
    pub async fn reset_skin(&self, access_token: &str, uuid: &str) -> Result<()> {
        debug!("API call: reset_skin for UUID: {}", uuid);

        let url = format!("{}/user/profile/{}/skin", MOJANG_API_URL, uuid);
        debug!("Request URL: {}", url);

        let client = reqwest::Client::new();
        debug!("Sending skin reset request to Minecraft API");

        let response_result = client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await;

        if let Err(ref e) = response_result {
            debug!("API request failed: {:?}", e);
        }

        let response = response_result.map_err(AppError::MinecraftApi)?;
        debug!("Received response with status: {}", response.status());

        // Check if successful
        if !response.status().is_success() {
            let error_text_result = response.text().await;

            if let Err(ref e) = error_text_result {
                debug!("Failed to read error response: {:?}", e);
            }

            let error_text = error_text_result.map_err(AppError::MinecraftApi)?;
            debug!("Skin reset failed: {}", error_text);
            return Err(AppError::Other(format!(
                "Failed to reset skin: {}",
                error_text
            )));
        }

        debug!("API call completed: reset_skin - Skin reset successfully");
        Ok(())
    }

    // Change skin using base64 data (requires authentication)
    pub async fn change_skin_from_base64(
        &self,
        access_token: &str,
        base64_data: &str,
        skin_variant: &str,
    ) -> Result<()> {
        debug!(
            "API call: change_skin_from_base64 with variant: {}",
            skin_variant
        );
        debug!("Base64 data length: {} characters", base64_data.len());

        let url = format!("https://api.minecraftservices.com/minecraft/profile/skins");
        debug!("Request URL: {}", url);

        // Decode base64 data to bytes
        debug!("Decoding base64 data");
        let file_content = match base64::decode(base64_data) {
            Ok(content) => {
                debug!("Successfully decoded base64 data ({} bytes)", content.len());
                content
            }
            Err(e) => {
                debug!("Failed to decode base64 data: {}", e);
                return Err(AppError::Other(format!(
                    "Failed to decode base64 skin data: {}",
                    e
                )));
            }
        };

        let client = reqwest::Client::new();
        debug!("Creating multipart form with file and variant");

        // Create form with file part and variant part
        let mime_result = reqwest::multipart::Part::bytes(file_content)
            .file_name("skin.png")
            .mime_str("image/png");

        if let Err(ref e) = mime_result {
            debug!("Failed to set MIME type: {}", e);
        }

        let form = reqwest::multipart::Form::new()
            .part(
                "file",
                mime_result.map_err(|e| AppError::Other(format!("Invalid MIME type: {}", e)))?,
            )
            .text("variant", skin_variant.to_string());

        debug!("Sending skin upload request to Minecraft API");
        // Send multipart request
        let response_result = client
            .post(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .multipart(form)
            .send()
            .await;

        if let Err(ref e) = response_result {
            debug!("API request failed: {:?}", e);
        }

        let response = response_result.map_err(AppError::MinecraftApi)?;
        debug!("Received response with status: {}", response.status());

        // Check if successful
        if !response.status().is_success() {
            let error_text_result = response.text().await;

            if let Err(ref e) = error_text_result {
                debug!("Failed to read error response: {:?}", e);
            }

            let error_text = error_text_result.map_err(AppError::MinecraftApi)?;
            debug!("Skin upload failed: {}", error_text);
            return Err(AppError::Other(format!(
                "Failed to change skin: {}",
                error_text
            )));
        }

        debug!("API call completed: change_skin_from_base64 - Skin uploaded successfully");
        Ok(())
    }
}
