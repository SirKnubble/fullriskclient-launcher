use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::AssetIndex;
use crate::state::event_state::{EventPayload, EventType};
use crate::state::State;
use async_compression::tokio::bufread::GzipDecoder;
// Import the Engine trait for encode/decode methods
// Corrected import
use fastnbt::from_bytes; // NBT deserialization
                         // Access NBT values
                         // GZip decompression
use log::{debug, error, info, warn};
use serde::Deserialize;
use serde::Serialize; // Added Serialize directly
                      // To represent NBT Compound
use futures::future::try_join_all;
use std::env;
use std::io::{Cursor, Read}; // Needed for reading NBT from bytes and decompression
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::fs;
use tokio::io::{AsyncReadExt as _, BufReader};
use tokio::sync::Semaphore;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::TokioAsyncResolver;
use uuid::Uuid;
// Zusätzlicher Import für Url

// --- New Helper Imports for Skin Fetching ---
use crate::minecraft::dto::minecraft_profile::{
    MinecraftProfile, TextureInfo, TextureMetadata, TexturesData, TexturesDictionary,
}; // Assuming these are public
use crate::minecraft::dto::skin_payloads::SkinModelVariant; // Added import for new Enum
use crate::utils::path_utils;
use base64::{decode as base64_decode_str, encode as base64_encode_bytes};
use std::path::Path;

// --- End New Helper Imports ---

// Referenziere unsere server_ping-Modul, das sich im gleichen Verzeichnis befindet

// --- Struct for World Info ---
#[derive(Debug, Clone, Serialize)]
pub struct WorldInfo {
    pub folder_name: String,
    pub display_name: Option<String>,
    pub last_played: Option<i64>,
    pub icon_path: Option<PathBuf>,
    pub game_mode: Option<i32>,
    pub difficulty: Option<i8>,
    pub difficulty_locked: Option<bool>,
    pub is_hardcore: Option<bool>,
    pub version_name: Option<String>,
}

// --- NBT Structures (simplified for what we need) ---
#[derive(Deserialize, Debug)]
struct LevelDat {
    #[serde(rename = "Data")]
    data: LevelData,
}

#[derive(Deserialize, Debug)]
struct LevelData {
    #[serde(rename = "LevelName")]
    level_name: Option<String>,
    #[serde(rename = "LastPlayed")]
    last_played: Option<i64>,
    #[serde(rename = "GameType")]
    game_type: Option<i32>,
    #[serde(rename = "Difficulty")]
    difficulty: Option<i8>,
    #[serde(rename = "DifficultyLocked")]
    difficulty_locked: Option<u8>,
    #[serde(rename = "hardcore")]
    hardcore: Option<u8>,
    #[serde(rename = "Version")]
    version: Option<VersionData>,
}

// Nested struct for version info
#[derive(Deserialize, Debug)]
struct VersionData {
    #[serde(rename = "Name")]
    name: Option<String>,
    // Add Id and Snapshot if needed later
}

/// Returns the path to the default .minecraft directory based on OS
pub fn get_default_minecraft_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        // Windows: %APPDATA%\.minecraft
        match env::var("APPDATA") {
            Ok(app_data) => PathBuf::from(app_data).join(".minecraft"),
            Err(_) => {
                warn!("[MC Utils] Failed to get APPDATA environment variable");
                // Fallback to user profile directory
                match dirs::home_dir() {
                    Some(home) => home.join("AppData").join("Roaming").join(".minecraft"),
                    None => PathBuf::new(), // Empty path if we can't find it
                }
            }
        }
    } else if cfg!(target_os = "macos") {
        // macOS: ~/Library/Application Support/minecraft
        match dirs::home_dir() {
            Some(home) => home
                .join("Library")
                .join("Application Support")
                .join("minecraft"),
            None => PathBuf::new(),
        }
    } else {
        // Linux and others: ~/.minecraft
        match dirs::home_dir() {
            Some(home) => home.join(".minecraft"),
            None => PathBuf::new(),
        }
    }
}

/// Checks if standard Minecraft assets can be reused and copies them if possible
/// Returns Ok(true) if assets were copied, Ok(false) if they weren't
pub async fn try_reuse_minecraft_assets(asset_index: &AssetIndex) -> Result<bool> {
    try_reuse_minecraft_assets_with_progress(asset_index, Uuid::nil()).await
}

/// Version of try_reuse_minecraft_assets that reports progress events
pub async fn try_reuse_minecraft_assets_with_progress(
    asset_index: &AssetIndex,
    profile_id: Uuid,
) -> Result<bool> {
    // Try to get state for events
    let state = if profile_id != Uuid::nil() {
        match State::get().await {
            Ok(s) => Some(s),
            Err(e) => {
                warn!("[MC Utils] Couldn't get state for events: {}", e);
                None
            }
        }
    } else {
        None
    };

    // Send initial progress event
    if let Some(state_ref) = &state {
        emit_reuse_progress(
            state_ref,
            profile_id,
            &format!(
                "Checking for existing Minecraft assets (index: {})",
                asset_index.id
            ),
            0.01,
            None,
        )
        .await?;
    }

    // Log what we're trying to do
    info!(
        "[MC Utils] Checking for existing Minecraft assets (index: {})",
        asset_index.id
    );

    // Get paths
    let default_mc_dir = get_default_minecraft_dir();
    if !default_mc_dir.exists() {
        info!(
            "[MC Utils] Default Minecraft directory not found at: {}",
            default_mc_dir.display()
        );

        if let Some(state_ref) = &state {
            emit_reuse_progress(
                state_ref,
                profile_id,
                "No existing Minecraft installation found, will download assets directly",
                0.05,
                None,
            )
            .await?;
        }

        return Ok(false);
    }

    // Progress update
    if let Some(state_ref) = &state {
        emit_reuse_progress(
            state_ref,
            profile_id,
            &format!("Found Minecraft directory at: {}", default_mc_dir.display()),
            0.05,
            None,
        )
        .await?;
    }

    let source_indexes_dir = default_mc_dir.join("assets").join("indexes");
    let source_index_file = source_indexes_dir.join(format!("{}.json", asset_index.id));

    // Check if the source index file exists
    if !source_index_file.exists() {
        info!(
            "[MC Utils] Asset index file not found at: {}",
            source_index_file.display()
        );

        if let Some(state_ref) = &state {
            emit_reuse_progress(
                state_ref,
                profile_id,
                &format!(
                    "Asset index {} not found in existing Minecraft installation",
                    asset_index.id
                ),
                0.05,
                None,
            )
            .await?;
        }

        return Ok(false);
    }

    // Get destination dirs
    let dest_assets_dir = LAUNCHER_DIRECTORY.meta_dir().join("assets");
    let dest_indexes_dir = dest_assets_dir.join("indexes");
    let dest_index_file = dest_indexes_dir.join(format!("{}.json", asset_index.id));

    // Check if we already have the assets
    if dest_index_file.exists() {
        debug!("[MC Utils] Asset index already exists in launcher directory");

        // Check if size matches
        match fs::metadata(&dest_index_file).await {
            Ok(metadata) => {
                if metadata.len() as i64 == asset_index.size {
                    info!(
                        "[MC Utils] Asset index already exists with correct size, no need to copy"
                    );

                    if let Some(state_ref) = &state {
                        emit_reuse_progress(
                            state_ref,
                            profile_id,
                            "Asset index already exists with correct size, no need to copy",
                            0.1,
                            None,
                        )
                        .await?;
                    }

                    return Ok(false); // Already have it with correct size
                }
                info!("[MC Utils] Asset index exists but size mismatch, will copy from default MC dir");
            }
            Err(e) => {
                warn!(
                    "[MC Utils] Failed to get metadata for existing asset index: {}",
                    e
                );
            }
        }
    }

    // Progress update
    if let Some(state_ref) = &state {
        emit_reuse_progress(
            state_ref,
            profile_id,
            "Found existing Minecraft assets, preparing to copy",
            0.1,
            None,
        )
        .await?;
    }

    // Create destination directories if they don't exist
    info!("[MC Utils] Creating asset directories if needed");
    fs::create_dir_all(&dest_indexes_dir).await?;
    fs::create_dir_all(dest_assets_dir.join("objects")).await?;

    // Copy the index file
    info!(
        "[MC Utils] Copying asset index from: {}",
        source_index_file.display()
    );
    match fs::copy(&source_index_file, &dest_index_file).await {
        Ok(_) => {
            info!("[MC Utils] Successfully copied asset index file");

            // Progress update
            if let Some(state_ref) = &state {
                emit_reuse_progress(
                    state_ref,
                    profile_id,
                    "Successfully copied asset index file",
                    0.15,
                    None,
                )
                .await?;
            }
        }
        Err(e) => {
            error!("[MC Utils] Failed to copy asset index file: {}", e);

            // Error progress update
            if let Some(state_ref) = &state {
                emit_reuse_progress(
                    state_ref,
                    profile_id,
                    &format!("Failed to copy asset index file: {}", e),
                    0.15,
                    Some(e.to_string()),
                )
                .await?;
            }

            return Err(AppError::Io(e));
        }
    }

    // Copy the assets (objects)
    let source_objects_dir = default_mc_dir.join("assets").join("objects");
    let dest_objects_dir = dest_assets_dir.join("objects");

    if !source_objects_dir.exists() {
        warn!(
            "[MC Utils] Source objects directory not found at: {}",
            source_objects_dir.display()
        );

        // Progress update
        if let Some(state_ref) = &state {
            emit_reuse_progress(
                state_ref,
                profile_id,
                "Copied index but assets directory not found, will download assets directly",
                0.2,
                None,
            )
            .await?;
        }

        // Still return Ok(true) because we copied the index file
        return Ok(true);
    }

    // Read index file to get list of objects
    let index_content = fs::read_to_string(&dest_index_file).await?;
    let index_json: serde_json::Value = serde_json::from_str(&index_content)?;

    // Extract the objects
    if let Some(objects) = index_json.get("objects").and_then(|o| o.as_object()) {
        let total_objects = objects.len();
        info!("[MC Utils] Found {} assets to copy", total_objects);

        // Progress update
        if let Some(state_ref) = &state {
            emit_reuse_progress(
                state_ref,
                profile_id,
                &format!(
                    "Found {} assets to reuse from existing Minecraft installation",
                    total_objects
                ),
                0.2,
                None,
            )
            .await?;
        }

        let mut copied_count = 0;
        let mut skipped_count = 0;
        let mut error_count = 0;

        // Use atomic counters for progress tracking
        let progress_counter = Arc::new(AtomicUsize::new(0));
        let total_count = objects.len();

        // Batch size for progress updates - update every 5% or 100 files, whichever is smaller
        let update_batch = (total_count / 20).max(1).min(100);

        for (asset_name, object) in objects {
            if let (Some(hash), Some(size)) = (
                object.get("hash").and_then(|h| h.as_str()),
                object.get("size").and_then(|s| s.as_i64()),
            ) {
                // Create hash folder (first 2 chars of hash)
                let hash_prefix = &hash[0..2];
                let source_hash_dir = source_objects_dir.join(hash_prefix);
                let dest_hash_dir = dest_objects_dir.join(hash_prefix);

                // Create destination hash directory if it doesn't exist
                if !dest_hash_dir.exists() {
                    if let Err(e) = fs::create_dir_all(&dest_hash_dir).await {
                        error!(
                            "[MC Utils] Failed to create hash directory {}: {}",
                            dest_hash_dir.display(),
                            e
                        );
                        error_count += 1;
                        continue;
                    }
                }

                let source_file = source_hash_dir.join(hash);
                let dest_file = dest_hash_dir.join(hash);

                // Skip if dest file already exists with correct size
                if dest_file.exists() {
                    match fs::metadata(&dest_file).await {
                        Ok(metadata) => {
                            if metadata.len() as i64 == size {
                                debug!(
                                    "[MC Utils] Asset already exists with correct size: {}",
                                    hash
                                );
                                skipped_count += 1;

                                // Update progress counter
                                let progress = progress_counter.fetch_add(1, Ordering::SeqCst) + 1;

                                // Report progress periodically
                                if let Some(state_ref) = &state {
                                    let percent_complete = progress as f64 / total_count as f64;
                                    let scaled_progress = 0.2 + (percent_complete * 0.7); // Scale from 20% to 90%

                                    emit_reuse_progress(
                                        state_ref,
                                        profile_id,
                                        &format!(
                                            "Reusing Minecraft assets: {}/{} files processed",
                                            progress, total_count
                                        ),
                                        scaled_progress,
                                        None,
                                    )
                                    .await?;
                                }

                                continue;
                            }
                        }
                        Err(e) => {
                            warn!(
                                "[MC Utils] Failed to get metadata for existing asset: {}",
                                e
                            );
                        }
                    }
                }

                // Copy the file
                if source_file.exists() {
                    match fs::copy(&source_file, &dest_file).await {
                        Ok(_) => {
                            debug!("[MC Utils] Copied asset: {} ({})", hash, asset_name);
                            copied_count += 1;
                        }
                        Err(e) => {
                            error!("[MC Utils] Failed to copy asset {}: {}", hash, e);
                            error_count += 1;
                        }
                    }
                } else {
                    debug!(
                        "[MC Utils] Source asset not found: {}",
                        source_file.display()
                    );
                    error_count += 1;
                }

                // Update progress counter
                let progress = progress_counter.fetch_add(1, Ordering::SeqCst) + 1;

                // Report progress periodically
                if let Some(state_ref) = &state {
                    let percent_complete = progress as f64 / total_count as f64;
                    let scaled_progress = 0.2 + (percent_complete * 0.7); // Scale from 20% to 90%

                    emit_reuse_progress(
                        state_ref,
                        profile_id,
                        &format!(
                            "Reusing Minecraft assets: {}/{} files processed",
                            progress, total_count
                        ),
                        scaled_progress,
                        None,
                    )
                    .await?;
                }
            }
        }

        info!(
            "[MC Utils] Assets copy summary: copied {}, skipped {}, errors {}",
            copied_count, skipped_count, error_count
        );

        // Final progress update
        if let Some(state_ref) = &state {
            emit_reuse_progress(
                state_ref,
                profile_id,
                &format!(
                    "Successfully reused Minecraft assets: copied {}, reused {}, errors {}",
                    copied_count, skipped_count, error_count
                ),
                0.95,
                None,
            )
            .await?;
        }
    } else {
        warn!("[MC Utils] Failed to parse objects from asset index");

        // Error progress update
        if let Some(state_ref) = &state {
            emit_reuse_progress(
                state_ref,
                profile_id,
                "Failed to parse objects from asset index",
                0.5,
                Some("Parse error".to_string()),
            )
            .await?;
        }
    }

    Ok(true)
}

/// Helper function to emit progress events for asset reuse
async fn emit_reuse_progress(
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
            event_type: EventType::ReusingMinecraftAssets,
            target_id: Some(profile_id),
            message: message.to_string(),
            progress: Some(progress),
            error,
        })
        .await?;
    Ok(event_id)
}

/// Helper function to emit progress events for the initial data copy
async fn emit_copy_progress(
    state: &State,
    profile_id: Uuid,
    message: &str,
    progress: f64,
    error: Option<String>,
) -> Result<()> {
    state
        .emit_event(EventPayload {
            event_id: Uuid::new_v4(), // Each progress update is a unique event for simplicity here
            event_type: EventType::CopyingInitialData,
            target_id: Some(profile_id),
            message: message.to_string(),
            progress: Some(progress),
            error,
        })
        .await?;
    Ok(())
}

/// Copies initial user data (saves, options, etc.) from the default .minecraft directory
/// to a new profile's directory.
/// This runs only if the profile is a standard version and its directory is empty.
pub async fn copy_initial_data_from_default_minecraft(
    profile: &crate::state::profile_state::Profile,
    profile_dir: &PathBuf,
) -> Result<()> {
    let profile_id = profile.id;
    info!(
        "[{}] Checking if initial data should be imported for profile '{}'...",
        profile_id, profile.name
    );

    // Condition 1: Check the copy_initial_mc_data flag.
    let should_copy = profile
        .norisk_information
        .as_ref()
        .map_or(true, |info| info.copy_initial_mc_data);
    if !should_copy {
        info!(
            "[{}] Profile has copy_initial_mc_data set to false. Skipping initial data import.",
            profile_id
        );
        return Ok(());
    }

    // Condition 2: Only copy for standard versions.
    if !profile.is_standard_version {
        info!(
            "[{}] Profile is not a standard version. Skipping initial data import.",
            profile_id
        );
        return Ok(());
    }

    // Condition 3: Only copy into an empty directory.
    // A non-existent directory is also considered empty.
    if profile_dir.exists() {
        let mut entries = fs::read_dir(profile_dir).await?;
        if entries.next_entry().await?.is_some() {
            info!(
                "[{}] Profile directory is not empty. Skipping initial data import.",
                profile_id
            );
            return Ok(());
        }
    }

    info!(
        "[{}] Profile is a standard version with an empty directory. Proceeding with data import.",
        profile_id
    );

    let state = match State::get().await {
        Ok(s) => Some(s),
        Err(e) => {
            warn!(
                "[MC Utils] Couldn't get state for events during initial data copy: {}",
                e
            );
            None
        }
    };

    if let Some(s) = &state {
        emit_copy_progress(
            s,
            profile_id,
            "Checking for user data to import...",
            0.05,
            None,
        )
        .await?;
    }

    let default_mc_dir = get_default_minecraft_dir();
    if !default_mc_dir.exists() {
        info!(
            "[{}] Default Minecraft directory not found. Skipping initial data copy.",
            profile_id
        );
        if let Some(s) = &state {
            emit_copy_progress(
                s,
                profile_id,
                "Default Minecraft installation not found.",
                1.0,
                None,
            )
            .await?;
        }
        return Ok(());
    }

    info!(
        "[{}] Found default Minecraft directory at '{}'. Starting copy process.",
        profile_id,
        default_mc_dir.display()
    );
    if let Some(s) = &state {
        emit_copy_progress(
            s,
            profile_id,
            "Found existing installation, copying files...",
            0.1,
            None,
        )
        .await?;
    }

    let items_to_copy = [
        "saves",
        "config",
        "screenshots",
        "shaderpacks",
        "resourcepacks",
        "options.txt",
        "optionsof.txt",
        "servers.dat",
        "command_history.txt",
        "replay_recordings",
    ];

    let state_arc = State::get().await?;
    let semaphore = state_arc.io_semaphore.clone();
    let total_items = items_to_copy.len();
    let progress_counter = Arc::new(tokio::sync::Mutex::new(0));

    let mut top_level_futures = Vec::new();

    for item_name in items_to_copy {
        let src_path = default_mc_dir.join(item_name);
        let dest_path = profile_dir.join(item_name);
        let sem_clone = semaphore.clone();
        let state_clone = state.clone();
        let progress_counter_clone = progress_counter.clone();

        let fut = async move {
            if !fs::try_exists(&src_path).await? {
                warn!(
                    "[{}] Source item '{}' does not exist, skipping.",
                    profile_id,
                    src_path.display()
                );
                return Ok(());
            }

            let metadata = fs::metadata(&src_path).await?;
            if metadata.is_dir() {
                // This function handles its own parallelism, just await it
                path_utils::copy_dir_recursively(&src_path, &dest_path, sem_clone).await?;
            } else {
                // For single files, use a permit
                let _permit = sem_clone.acquire().await?;
                fs::copy(&src_path, &dest_path).await?;
            }

            // Progress reporting
            let mut num = progress_counter_clone.lock().await;
            *num += 1;
            if let Some(s) = &state_clone {
                let progress = 0.1 + (*num as f64 / total_items as f64) * 0.9;
                let message = format!("({}/{}) Importing user data...", *num, total_items);
                emit_copy_progress(s, profile_id, &message, progress, None).await?;
            }

            Ok::<(), AppError>(())
        };
        top_level_futures.push(fut);
    }

    if let Err(e) = try_join_all(top_level_futures).await {
        error!(
            "[{}] An error occurred during the parallel data import: {}",
            profile_id, e
        );
        if let Some(s) = &state {
            emit_copy_progress(
                s,
                profile_id,
                "Error during data import.",
                1.0,
                Some(e.to_string()),
            )
            .await?;
        }
        return Err(e);
    }

    info!("[{}] Initial data copy finished.", profile_id);
    if let Some(s) = &state {
        emit_copy_progress(s, profile_id, "User data import complete.", 1.0, None).await?;
    }

    Ok(())
}

// --- New Function to Get Profile Worlds ---
/// Lists the singleplayer worlds found in the profile's saves directory.
/// Currently only returns the folder name.
pub async fn get_profile_worlds(profile_id: Uuid) -> Result<Vec<WorldInfo>> {
    info!("[Worlds] Getting worlds for profile {}", profile_id);
    let state = State::get().await?;

    // Try to get the user profile first, or fall back to standard profile if ID matches
    let profile = match state.profile_manager.get_profile(profile_id).await {
        Ok(p) => {
            info!("[Worlds] Found user profile: {}", p.name);
            p // Found user profile
        }
        Err(AppError::ProfileNotFound(_)) => {
            // Not a user profile, check if it's a standard version
            match state
                .norisk_version_manager
                .get_profile_by_id(profile_id)
                .await
            {
                Some(standard_profile) => {
                    info!("[Worlds] ID {} matches standard profile: {}. Proceeding with standard profile object.", profile_id, standard_profile.name);
                    standard_profile // Use the standard profile object
                }
                None => {
                    error!(
                        "[Worlds] Profile ID {} not found as user profile or standard profile.",
                        profile_id
                    );
                    return Err(AppError::ProfileNotFound(profile_id)); // ID not found anywhere
                }
            }
        }
        Err(e) => return Err(e), // Propagate other errors (e.g., IO errors loading profiles.json)
    };

    // Calculate the instance path (this might not be meaningful for standard profiles)
    let instance_path = state
        .profile_manager
        .calculate_instance_path_for_profile(&profile)?;
    let saves_path = instance_path.join("saves");
    info!(
        "[Worlds] Checking saves directory: {}",
        saves_path.display()
    );

    if !saves_path.is_dir() {
        // This will likely be true for standard profiles
        info!("[Worlds] Saves directory not found or not a directory for profile '{}' (path: {}). Returning empty list.", profile.name, saves_path.display());
        return Ok(Vec::new());
    }

    let mut worlds = Vec::new();
    let mut read_dir = fs::read_dir(&saves_path).await?;

    while let Some(entry_result) = read_dir.next_entry().await? {
        let entry_path = entry_result.path();
        // Check if it's a directory AND contains a level.dat file
        if entry_path.is_dir() {
            let level_dat_path = entry_path.join("level.dat");
            if level_dat_path.is_file() {
                if let Some(folder_name) = entry_path.file_name().and_then(|n| n.to_str()) {
                    // Basic filtering: ignore folders starting with "."
                    if !folder_name.starts_with(".") {
                        let mut world_info = WorldInfo {
                            folder_name: folder_name.to_string(),
                            display_name: None,
                            last_played: None,
                            icon_path: None,
                            game_mode: None,
                            difficulty: None,
                            difficulty_locked: None,
                            is_hardcore: None,
                            version_name: None,
                        };

                        // Try to read and decompress level.dat asynchronously
                        match fs::File::open(&level_dat_path).await {
                            Ok(file) => {
                                let buf_reader = BufReader::new(file); // Wrap file in BufReader
                                let mut decoder = GzipDecoder::new(buf_reader);
                                let mut decompressed_bytes = Vec::new();
                                // Read decompressed bytes asynchronously
                                match decoder.read_to_end(&mut decompressed_bytes).await {
                                    Ok(_) => {
                                        // Now parse the decompressed bytes
                                        match from_bytes::<LevelDat>(&decompressed_bytes) {
                                            Ok(level_dat) => {
                                                info!(
                                                    "[Worlds] Parsed level.dat for '{}': Name={:?}, LastPlayed={:?}, GameType={:?}",
                                                    folder_name,
                                                    level_dat.data.level_name,
                                                    level_dat.data.last_played,
                                                    level_dat.data.game_type
                                                );
                                                world_info.display_name = level_dat.data.level_name;
                                                world_info.last_played = level_dat.data.last_played;
                                                world_info.game_mode = level_dat.data.game_type;
                                                world_info.difficulty = level_dat.data.difficulty;
                                                world_info.difficulty_locked = level_dat
                                                    .data
                                                    .difficulty_locked
                                                    .map(|b| b == 1);
                                                world_info.is_hardcore =
                                                    level_dat.data.hardcore.map(|b| b == 1);
                                                world_info.version_name = level_dat
                                                    .data
                                                    .version
                                                    .as_ref()
                                                    .and_then(|v| v.name.clone());
                                            }
                                            Err(e) => {
                                                warn!(
                                                    "[Worlds] Failed to parse decompressed NBT for '{}': {}. Path: {}",
                                                    folder_name,
                                                    e,
                                                    level_dat_path.display()
                                                );
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        warn!(
                                            "[Worlds] Failed to decompress level.dat asynchronously for '{}': {}. Path: {}",
                                            folder_name,
                                            e,
                                            level_dat_path.display()
                                        );
                                        // Consider if a fallback to non-async reading/parsing is needed/useful
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(
                                    "[Worlds] Failed to open level.dat for async reading '{}': {}. Path: {}",
                                    folder_name,
                                    e,
                                    level_dat_path.display()
                                );
                            }
                        }

                        // Check for icon.png
                        let icon_path = entry_path.join("icon.png");
                        if icon_path.is_file() {
                            info!("[Worlds] Found icon.png for '{}'", folder_name);
                            world_info.icon_path = Some(icon_path);
                        }

                        worlds.push(world_info);
                    } else {
                        debug!("[Worlds] Skipping hidden folder: {}", folder_name);
                    }
                } else {
                    warn!(
                        "[Worlds] Skipping entry with non-UTF8 name in saves directory: {:?}",
                        entry_path
                    );
                }
            } else {
                debug!(
                    "[Worlds] Skipping folder without level.dat: {}",
                    entry_path.display()
                );
            }
        }
    }

    // Sort worlds by last played descending (most recent first)
    worlds.sort_by(|a, b| b.last_played.cmp(&a.last_played));

    info!(
        "[Worlds] Found {} valid world(s) for profile {}",
        worlds.len(),
        profile_id
    );
    Ok(worlds)
}

// --- NBT Structures for servers.dat ---
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")] // Match NBT naming convention
struct ServerListNbt {
    servers: Vec<ServerEntryNbt>,
}

#[derive(serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")] // Match NBT naming convention
struct ServerEntryNbt {
    name: Option<String>,
    ip: Option<String>,
    icon: Option<String>, // Base64 encoded icon data
    #[serde(default)] // Handle cases where this field might be missing
    accept_textures: Option<u8>, // 0=prompt, 1=enabled, 2=disabled
    #[serde(default)]
    previews_chat: Option<u8>, // Seems to be boolean (0/1)
}

// --- Struct for Server Info (to be returned) ---
#[derive(Debug, Clone, serde::Serialize)]
pub struct ServerInfo {
    pub name: Option<String>,
    pub address: Option<String>, // Renamed from 'ip' for clarity
    pub icon_base64: Option<String>,
    pub accepts_textures: Option<u8>,
    pub previews_chat: Option<u8>,
}

/// Parses a Minecraft server address string (e.g., "example.com", "example.com:25566", "[::1]:25565")
/// into host and port, handling default port and IPv6 bracket notation.
/// Inspired by Modrinth Launcher's implementation.
fn parse_minecraft_address(address: &str) -> std::result::Result<(String, u16), String> {
    let default_port = 25565;
    let (host_part, port_str) = if address.starts_with('[') {
        // IPv6 Address like [::1] or [::1]:25566
        let close_bracket_index = match address.rfind(']') {
            Some(idx) => idx,
            None => return Err(format!("Invalid bracketed host/port: {}", address)),
        };

        // Check if it's just "[...]" or "[...]:port"
        if close_bracket_index + 1 == address.len() {
            // Just "[...]", use default port
            (&address[1..close_bracket_index], None)
        } else {
            // Should be "[...]:port"
            if address.as_bytes().get(close_bracket_index + 1) != Some(&b':') {
                return Err(format!(
                    "Only a colon may follow a close bracket: {}",
                    address
                ));
            }
            let port_part = &address[close_bracket_index + 2..];
            // Validate port part contains only digits
            if port_part.is_empty() || port_part.chars().any(|c| !c.is_ascii_digit()) {
                return Err(format!("Port must be numeric after brackets: {}", address));
            }
            (&address[1..close_bracket_index], Some(port_part))
        }
    } else {
        // IPv4 or Hostname like "example.com" or "example.com:25566"
        match address.rfind(':') {
            Some(colon_pos) => {
                // Check if this colon is part of an IPv6 address without brackets (less common but possible)
                // A simple heuristic: if there's another colon *before* this one, assume IPv6.
                if address[..colon_pos].contains(':') {
                    // Likely bare IPv6, treat whole string as host, use default port
                    (address, None)
                } else {
                    // Standard host:port
                    let host = &address[..colon_pos];
                    let port_part = &address[colon_pos + 1..];
                    // Validate port part contains only digits
                    if port_part.is_empty() || port_part.chars().any(|c| !c.is_ascii_digit()) {
                        return Err(format!("Port must be numeric: {}", address));
                    }
                    (host, Some(port_part))
                }
            }
            None => {
                // No colon, treat whole string as host, use default port
                (address, None)
            }
        }
    };

    let port = match port_str {
        Some(p_str) => match p_str.parse::<u16>() {
            Ok(p) => p,
            Err(_) => return Err(format!("Unparseable port number: {}", p_str)),
        },
        None => default_port,
    };

    // Basic validation: host part should not be empty
    if host_part.is_empty() {
        return Err(format!("Host part cannot be empty: {}", address));
    }

    Ok((host_part.to_string(), port))
}

/// Lists the multiplayer servers found in the profile's servers.dat file.
pub async fn get_profile_servers(profile_id: Uuid) -> Result<Vec<ServerInfo>> {
    info!("[Servers] Getting servers for profile {}", profile_id);
    let state = State::get().await?;

    // Try to get the user profile first, or fall back to standard profile if ID matches
    let profile = match state.profile_manager.get_profile(profile_id).await {
        Ok(p) => {
            info!("[Servers] Found user profile: {}", p.name);
            p // Found user profile
        }
        Err(AppError::ProfileNotFound(_)) => {
            // Not a user profile, check if it's a standard version
            match state
                .norisk_version_manager
                .get_profile_by_id(profile_id)
                .await
            {
                Some(standard_profile) => {
                    info!("[Servers] ID {} matches standard profile: {}. Proceeding with standard profile object.", profile_id, standard_profile.name);
                    standard_profile // Use the standard profile object
                }
                None => {
                    error!(
                        "[Servers] Profile ID {} not found as user profile or standard profile.",
                        profile_id
                    );
                    return Err(AppError::ProfileNotFound(profile_id)); // ID not found anywhere
                }
            }
        }
        Err(e) => return Err(e), // Propagate other errors
    };

    // Calculate the instance path
    let instance_path = state
        .profile_manager
        .calculate_instance_path_for_profile(&profile)?;
    let servers_dat_path = instance_path.join("servers.dat");
    info!(
        "[Servers] Looking for servers.dat at: {}",
        servers_dat_path.display()
    );

    if !servers_dat_path.is_file() {
        info!(
            "[Servers] servers.dat not found for profile '{}' (path: {}). Returning empty list.",
            profile.name,
            servers_dat_path.display()
        );
        return Ok(Vec::new()); // No servers.dat means no servers saved
    }

    // Read the servers.dat file
    let servers_dat_bytes = match fs::read(&servers_dat_path).await {
        Ok(bytes) => bytes,
        Err(e) => {
            error!(
                "[Servers] Failed to read servers.dat for profile '{}': {}. Path: {}",
                profile.name,
                e,
                servers_dat_path.display()
            );
            return Err(AppError::Io(e));
        }
    };

    // Parse the NBT data (servers.dat is typically *not* GZipped)
    let server_list_nbt: ServerListNbt = match from_bytes(&servers_dat_bytes) {
        Ok(data) => data,
        Err(e) => {
            // Try parsing with GZip decompression asynchronously as a fallback (less common)
            warn!(
                "[Servers] Failed to parse raw servers.dat for '{}': {}. Attempting GZip fallback...",
                profile.name,
                e
            );
            let reader = BufReader::new(Cursor::new(&servers_dat_bytes)); // Create async reader from bytes
            let mut decoder = GzipDecoder::new(reader);
            let mut decompressed_bytes = Vec::new();

            match decoder.read_to_end(&mut decompressed_bytes).await {
                Ok(_) => {
                    match from_bytes::<ServerListNbt>(&decompressed_bytes) {
                        Ok(decompressed_data) => {
                            warn!(
                                "[Servers] Successfully parsed servers.dat for '{}' after async GZip fallback.",
                                profile.name
                            );
                            decompressed_data
                        }
                        Err(decompressed_e) => {
                            error!(
                                "[Servers] Failed to parse NBT from GZipped servers.dat for '{}' (async fallback): {}. Path: {}",
                                profile.name,
                                decompressed_e,
                                servers_dat_path.display()
                            );
                            // Return original error if fallback parsing fails
                            return Err(AppError::Nbt(e));
                        }
                    }
                }
                Err(decompression_e) => {
                    error!(
                        "[Servers] Async GZip decompression failed for servers.dat for '{}': {}. Path: {}",
                        profile.name,
                        decompression_e,
                        servers_dat_path.display()
                    );
                    // Return original error if decompression fails
                    return Err(AppError::Nbt(e));
                }
            }
        }
    };

    // Map the NBT structure to our ServerInfo structure
    let server_infos: Vec<ServerInfo> = server_list_nbt
        .servers
        .into_iter()
        .map(|nbt_entry| {
            ServerInfo {
                name: nbt_entry.name,
                address: nbt_entry.ip, // Map 'ip' to 'address'
                icon_base64: nbt_entry.icon,
                accepts_textures: nbt_entry.accept_textures,
                previews_chat: nbt_entry.previews_chat,
            }
        })
        .collect();

    info!(
        "[Servers] Found {} server entries in servers.dat for profile {}",
        server_infos.len(),
        profile_id
    );
    Ok(server_infos)
}

// --- Structures for Server Ping Results ---

#[derive(Debug, Clone, Serialize)]
pub struct ServerPingInfo {
    pub description: Option<String>, // Simple text MOTD for now
    pub description_json: Option<serde_json::Value>, // Full JSON MOTD
    pub version_name: Option<String>,
    pub version_protocol: Option<i32>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    pub favicon_base64: Option<String>, // Base64 PNG string (without data:image/png;base64,)
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")] // Don't include error if None
    pub error: Option<String>,
}

// Simplified version for pinging, add more fields if needed
impl ServerPingInfo {
    // Helper to create an error response
    fn error(address: &str, error_msg: String, latency: Option<u64>) -> Self {
        warn!("[Server Ping] Error pinging {}: {}", address, error_msg);
        ServerPingInfo {
            description: None,
            description_json: None,
            version_name: None,
            version_protocol: None,
            players_online: None,
            players_max: None,
            favicon_base64: None,
            latency_ms: latency, // Include latency if measured before error
            error: Some(error_msg),
        }
    }

    // Konvertiere ServerStatus zu ServerPingInfo
    fn from_server_status(status: super::server_ping::ServerStatus) -> Self {
        // Extrahiere Text aus JSON-Beschreibung wenn vorhanden
        let (simple_description, json_description) = if let Some(raw_value) = status.description {
            match serde_json::from_str::<serde_json::Value>(raw_value.get()) {
                Ok(json) => {
                    let text = extract_text_from_json(&json);
                    (text, Some(json))
                }
                Err(_) => (Some(raw_value.get().to_string()), None),
            }
        } else {
            (None, None)
        };

        // Favicon URL zu Base64 konvertieren (ohne data:image/png;base64, Präfix)
        let favicon_base64 = status.favicon.and_then(|url| {
            if url.scheme() == "data" && url.path().starts_with("image/png;base64,") {
                let base64_data = url.path().strip_prefix("image/png;base64,")?.to_string();
                Some(base64_data)
            } else {
                None
            }
        });

        ServerPingInfo {
            description: simple_description,
            description_json: json_description,
            version_name: status.version.as_ref().map(|v| v.name.clone()),
            version_protocol: status.version.as_ref().map(|v| v.protocol),
            players_online: status.players.as_ref().map(|p| p.online as u32),
            players_max: status.players.as_ref().map(|p| p.max as u32),
            favicon_base64,
            latency_ms: status.ping.map(|p| p as u64),
            error: None,
        }
    }
}

// Hilfsfunktion zum Extrahieren von einfachem Text aus Minecraft Chat-JSON
fn extract_text_from_json(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Object(obj) => {
            let mut result = String::new();

            // "text"-Feld extrahieren
            if let Some(serde_json::Value::String(text)) = obj.get("text") {
                result.push_str(text);
            }

            // "extra"-Array durchgehen und rekursiv Text extrahieren
            if let Some(serde_json::Value::Array(extras)) = obj.get("extra") {
                for extra in extras {
                    if let Some(extra_text) = extract_text_from_json(extra) {
                        result.push_str(&extra_text);
                    }
                }
            }

            if result.is_empty() {
                None
            } else {
                Some(result)
            }
        }
        _ => None,
    }
}

// Function to perform the server ping
pub async fn ping_server_status(address: &str) -> ServerPingInfo {
    info!("[Server Ping] Pinging server address: {}", address);

    // Parse the address
    let (host, port) = match parse_minecraft_address(address) {
        Ok((h, p)) => (h, p),
        Err(e) => {
            return ServerPingInfo::error(address, format!("Invalid address format: {}", e), None);
        }
    };

    // Resolve the server (including SRV records)
    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

    // SRV Lookup
    let srv_query = format!("_minecraft._tcp.{}", host);
    info!("[Server Ping] Attempting SRV lookup for: {}", srv_query);

    let (target_host, target_port) = match resolver.srv_lookup(srv_query.as_str()).await {
        Ok(srv) => {
            if let Some(record) = srv
                .iter()
                .min_by_key(|r| (r.priority(), std::cmp::Reverse(r.weight())))
            {
                let srv_host = record.target().to_utf8();
                let srv_port = record.port();
                info!(
                    "[Server Ping] SRV lookup successful: Target = {}:{}",
                    srv_host, srv_port
                );
                (srv_host, srv_port)
            } else {
                info!("[Server Ping] SRV lookup for '{}' returned no records. Using parsed host/port.", srv_query);
                (host.to_string(), port)
            }
        }
        Err(e) => {
            warn!(
                "[Server Ping] SRV lookup for '{}' failed: {}. Falling back to parsed host/port.",
                srv_query, e
            );
            (host.to_string(), port)
        }
    };

    // Resolve IP address
    let ip_lookup = resolver.lookup_ip(target_host.as_str()).await;
    let socket_address = match ip_lookup {
        Ok(lookup) => match lookup.iter().next() {
            Some(ip) => SocketAddr::new(ip, target_port),
            None => {
                return ServerPingInfo::error(
                    address,
                    format!("DNS lookup for '{}' returned no IP addresses", target_host),
                    None,
                );
            }
        },
        Err(e) => {
            return ServerPingInfo::error(
                address,
                format!("Failed to resolve hostname '{}': {}", target_host, e),
                None,
            );
        }
    };

    info!("[Server Ping] Resolved to: {}", socket_address);

    // Ping the server using our server_ping implementation
    match super::server_ping::get_server_status(&socket_address, (&target_host, target_port), None)
        .await
    {
        Ok(status) => ServerPingInfo::from_server_status(status),
        Err(e) => ServerPingInfo::error(address, format!("Server ping failed: {}", e), None),
    }
}

// --- Helper functions for add_skin_locally command ---

/// Downloads an image from a URL and encodes it as a Base64 string.
pub async fn fetch_image_as_base64(url: &str) -> Result<String> {
    debug!("[MC Utils] Fetching image from URL: {}", url);
    // Use the global HTTP_CLIENT from config.rs
    let response = crate::config::HTTP_CLIENT
        .get(url)
        .send()
        .await
        .map_err(|e| {
            error!("[MC Utils] Request to {} failed: {}", url, e);
            AppError::MinecraftApi(e) // Or a more specific error type if suitable
        })?;

    if !response.status().is_success() {
        error!(
            "[MC Utils] Failed to download image from {}. Status: {}",
            url,
            response.status()
        );
        return Err(AppError::Other(format!(
            "Failed to download image from URL {}: {}",
            url,
            response.status()
        )));
    }
    let bytes = response.bytes().await.map_err(AppError::MinecraftApi)?;
    Ok(base64_encode_bytes(&bytes))
}

/// Extracts skin URL, variant, and profile name from a MinecraftProfile.
pub fn extract_skin_info_from_profile(
    profile: &MinecraftProfile,
) -> Result<(String, SkinModelVariant, String)> {
    debug!(
        "[MC Utils] Extracting skin info from profile: {}",
        profile.name
    );
    let textures_prop = profile
        .properties
        .iter()
        .find(|p| p.name == "textures")
        .ok_or_else(|| {
            error!(
                "[MC Utils] Textures property not found in profile {}",
                profile.name
            );
            AppError::Other("Textures property not found in profile".to_string())
        })?;

    let decoded_textures_value = base64_decode_str(&textures_prop.value).map_err(|e| {
        error!(
            "[MC Utils] Failed to decode textures base64 for profile {}: {}",
            profile.name, e
        );
        AppError::Other(format!("Failed to decode textures base64: {}", e))
    })?;
    let textures_json_str = String::from_utf8(decoded_textures_value).map_err(|e| {
        error!(
            "[MC Utils] Failed to convert decoded textures to string for profile {}: {}",
            profile.name, e
        );
        AppError::Other(format!(
            "Failed to convert decoded textures to string: {}",
            e
        ))
    })?;
    let textures_data: TexturesData = serde_json::from_str(&textures_json_str).map_err(|e| {
        error!(
            "[MC Utils] Failed to parse textures JSON for profile {}: {}\nJSON: {}",
            profile.name, e, textures_json_str
        );
        AppError::Other(format!("Failed to parse textures JSON: {}", e))
    })?;

    // Access textures.SKIN correctly
    let skin_texture_info = textures_data
        .textures // This is TexturesDictionary
        .SKIN // This is Option<TextureInfo>
        .ok_or_else(|| {
            error!(
                "[MC Utils] SKIN texture info not found for profile {}",
                profile.name
            );
            AppError::Other("SKIN texture info not found in profile textures".to_string())
        })?;

    let skin_url = skin_texture_info.url;
    let skin_variant = skin_texture_info
        .metadata
        .and_then(|meta| meta.model) // model is Option<String>
        .map_or(SkinModelVariant::Classic, |model_str| {
            if model_str.to_lowercase() == "slim" {
                SkinModelVariant::Slim
            } else {
                SkinModelVariant::Classic // Default to classic for "default" or any other value
            }
        });
    let profile_name = profile.name.clone();

    debug!(
        "[MC Utils] Extracted info for profile {}: URL={}, Variant={}, Name={}",
        profile.name, skin_url, skin_variant, profile_name
    );
    Ok((skin_url, skin_variant, profile_name))
}
