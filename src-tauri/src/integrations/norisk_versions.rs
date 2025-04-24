use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::state::profile_state::{ModLoader, Profile, ProfileSettings, ProfileState};
use log::{self, error, info, warn, debug};
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;
use std::env;
use chrono::Utc;

const NORISK_API_BASE_URL: &str = "https://api.noriskclient.com/v1";

/// Represents a standard profile configuration from the NoRisk backend.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoriskVersionProfile {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub mc_version: String,
    pub loader: ModLoader,
    pub loader_version: Option<String>,
    pub norisk_pack: Option<String>,
    pub custom_path: PathBuf,
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

/// Copies a dummy/default `norisk_versions.json` from the project's source directory
/// (assuming a development environment structure) to the launcher's root directory
/// if it doesn't already exist.
/// 
/// Note: This path resolution using CARGO_MANIFEST_DIR might not work correctly
/// in a packaged production build. Consider using Tauri's resource resolver for that.
pub async fn load_dummy_versions() -> Result<()> {
    let target_dir = LAUNCHER_DIRECTORY.root_dir();
    let target_file = target_dir.join("norisk_versions.json");

    if target_file.exists() {
        //info!("Target file {:?} already exists. Skipping dummy version loading.", target_file);
        //return Ok(());
    }

    // --- Path resolution based on CARGO_MANIFEST_DIR --- 
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // Assuming the project root is one level above the crate's manifest (src-tauri)
    let project_root = manifest_dir.parent().ok_or_else(|| {
        AppError::Other("Failed to get parent directory of CARGO_MANIFEST_DIR".to_string())
    })?;
    
    let source_path = project_root.join("minecraft-data/nrc/norisk_versions.json");
    // --- End path resolution ---

    if source_path.exists() {
        info!("Found dummy versions source at: {:?}", source_path);
        // Ensure the target directory exists
        fs::create_dir_all(&target_dir).await.map_err(|e| {
            error!("Failed to create target directory {:?}: {}", target_dir, e);
            AppError::Io(e)
        })?;

        // Copy the file
        fs::copy(&source_path, &target_file).await.map_err(|e| {
            error!("Failed to copy dummy versions from {:?} to {:?}: {}", source_path, target_file, e);
            AppError::Io(e)
        })?;
        info!("Successfully copied dummy versions to {:?}", target_file);
    } else {
        error!("Dummy versions source file not found at expected path: {:?}", source_path);
        // Use a more general error as it's not a Tauri resource issue anymore
        return Err(AppError::Other(format!(
            "Source file not found for dummy versions: {}",
            source_path.display()
        )));
    }

    Ok(())
}

/// Converts a standard profile template into a new, initial user profile.
pub fn convert_standard_to_user_profile(
    standard_profile: &NoriskVersionProfile,
) -> Result<Profile> {
    debug!("Attempting to convert standard profile: {:?}", standard_profile);

    // Note: Reusing standard_profile.id for the new profile ID is generally not recommended.
    // Each user profile should ideally have a unique UUID.
    let profile_id_to_use = standard_profile.id;
    
    // Convert PathBuf to String for the 'path' field.
    // This stores the *entire* path from the standard profile definition.
    let profile_path_str = standard_profile.custom_path.to_string_lossy().to_string();
    debug!("Using path string for new profile: {}", profile_path_str);

    let profile = Profile {
        id: profile_id_to_use, // Uses the original standard profile ID
        name: standard_profile.name.clone(),
        path: profile_path_str, 
        game_version: standard_profile.mc_version.clone(),
        loader: standard_profile.loader, // Assuming ModLoader is Copy
        loader_version: standard_profile.loader_version.clone(),
        created: Utc::now(),
        last_played: None,
        settings: ProfileSettings::default(),
        state: ProfileState::NotInstalled,
        mods: Vec::new(), // Start with no mods, they will be added by installer/pack logic
        selected_norisk_pack_id: standard_profile.norisk_pack.clone(),
        disabled_norisk_mods_detailed: HashSet::new(),
        source_standard_profile_id: Some(standard_profile.id), // Link back to the source
    };

    debug!("Successfully created new Profile struct: {:?}", profile);
    Ok(profile)
}