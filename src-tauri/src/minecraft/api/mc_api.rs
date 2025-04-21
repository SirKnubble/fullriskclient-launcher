use crate::minecraft::dto::version_manifest::VersionManifest;
use crate::minecraft::dto::piston_meta::PistonMeta;
use crate::error::{AppError, Result};
use reqwest;

const VERSION_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

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
} 