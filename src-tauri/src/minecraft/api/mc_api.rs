use crate::minecraft::dto::version_manifest::VersionManifest;
use crate::minecraft::dto::piston_meta::PistonMeta;
use crate::minecraft::dto::minecraft_profile::MinecraftProfile;
use crate::error::{AppError, Result};
use reqwest;
use std::path::Path;
use std::fs;

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
        let response = reqwest::get(url)
            .await
            .map_err(AppError::MinecraftApi)?;
        
        let meta = response
            .json::<PistonMeta>()
            .await
            .map_err(AppError::MinecraftApi)?;
        
        Ok(meta)
    }
    
    // Get user profile including skin information
    pub async fn get_user_profile(&self, uuid: &str) -> Result<MinecraftProfile> {
        let url = format!("{}/session/minecraft/profile/{}", MOJANG_SESSION_URL, uuid);
        
        let response = reqwest::get(&url)
            .await
            .map_err(AppError::MinecraftApi)?;
            
        let profile = response
            .json::<MinecraftProfile>()
            .await
            .map_err(AppError::MinecraftApi)?;
            
        Ok(profile)
    }
    
    // Change skin using access token (requires authentication)
    pub async fn change_skin(&self, access_token: &str, uuid: &str, skin_path: &str, skin_variant: &str) -> Result<()> {
        let url = format!("https://api.minecraftservices.com/minecraft/profile/skins");
        
        // Read skin file as bytes
        let file_content = match fs::read(skin_path) {
            Ok(content) => content,
            Err(e) => return Err(AppError::Other(format!("Failed to read skin file: {}", e))),
        };
        
        // Get filename from path
        let filename = Path::new(skin_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("skin.png");
            
        let client = reqwest::Client::new();
        
        // Create form with file part and variant part
        let form = reqwest::multipart::Form::new()
            .part("file", reqwest::multipart::Part::bytes(file_content)
                .file_name(filename.to_string())
                .mime_str("image/png")
                .map_err(|e| AppError::Other(format!("Invalid MIME type: {}", e)))?)
            .text("variant", skin_variant.to_string());
            
        // Send multipart request
        let response = client
            .post(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .multipart(form)
            .send()
            .await
            .map_err(AppError::MinecraftApi)?;
            
        // Check if successful
        if !response.status().is_success() {
            let error_text = response.text().await
                .map_err(AppError::MinecraftApi)?;
            return Err(AppError::Other(format!("Failed to change skin: {}", error_text)));
        }
        
        Ok(())
    }
    
    // Reset skin to default
    pub async fn reset_skin(&self, access_token: &str, uuid: &str) -> Result<()> {
        let url = format!("{}/user/profile/{}/skin", MOJANG_API_URL, uuid);
        
        let client = reqwest::Client::new();
        let response = client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(AppError::MinecraftApi)?;
            
        // Check if successful
        if !response.status().is_success() {
            let error_text = response.text().await
                .map_err(AppError::MinecraftApi)?;
            return Err(AppError::Other(format!("Failed to reset skin: {}", error_text)));
        }
        
        Ok(())
    }
} 