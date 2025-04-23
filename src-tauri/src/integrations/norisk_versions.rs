use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::state::profile_state::ModLoader;
use log::{self, error, info, warn};
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

const NORISK_API_BASE_URL: &str = "https://api.noriskclient.com/v1";

/// Represents a standard profile configuration from the NoRisk backend.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoriskVersionProfile {
    /// Unique identifier for the profile
    pub id: Uuid,
    /// User-friendly display name
    pub display_name: String,
    /// Description of the profile
    pub description: String,
    /// Minecraft version (e.g., "1.21.4")
    pub mc_version: String,
    /// Loader type (e.g., "fabric", "forge", "vanilla")
    pub loader: ModLoader,
    /// Loader version
    pub loader_version: Option<String>,
    /// Optional NoRisk client pack to use with this profile
    pub norisk_pack: Option<String>,
    /// Optional custom path for the profile (if not using default)
    pub custom_path: Option<PathBuf>,
}

/// Represents the overall structure of the standard profiles from the backend
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoriskVersionsConfig {
    /// A list of standard profiles
    pub profiles: Vec<NoriskVersionProfile>,
}

/// Loads standard profiles from the local `norisk_versions.json` file.
/// Returns an empty config if the file doesn't exist.
pub async fn load_local_standard_profiles() -> Result<NoriskVersionsConfig> {
    let root_dir = LAUNCHER_DIRECTORY.root_dir();
    let file_path = root_dir.join("norisk_versions.json");

    info!(
        "Attempting to load local standard profiles from: {:?}",
        file_path
    );

    if !file_path.exists() {
        warn!(
            "Local standard profiles file not found at {:?}. Returning empty config.",
            file_path
        );
        return Ok(NoriskVersionsConfig { profiles: vec![] });
    }

    let data = fs::read_to_string(&file_path).await.map_err(|e| {
        error!(
            "Failed to read local standard profiles file {:?}: {}",
            file_path, e
        );
        AppError::Io(e)
    })?;

    let profiles_config: NoriskVersionsConfig = serde_json::from_str(&data).map_err(|e| {
        error!(
            "Failed to parse local standard profiles file {:?}: {}",
            file_path, e
        );
        AppError::ParseError(format!("Failed to parse norisk_versions.json: {}", e))
    })?;

    info!(
        "Successfully loaded {} local standard profiles from {:?}",
        profiles_config.profiles.len(),
        file_path
    );
    Ok(profiles_config)
}
