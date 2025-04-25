use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::error::{AppError, Result};
use crate::state::profile_state::{ModLoader, Profile, ProfileSettings, ProfileState, Mod, ModSource};
use async_zip::tokio::read::seek::ZipFileReader;
use std::path::{PathBuf, Path};
use tokio::fs::File;
use tokio::io::BufReader;
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashSet;
use log::{info, error, warn, debug};
use sanitize_filename::sanitize;
use crate::integrations::modrinth;
use crate::state::state_manager::State;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tempfile::tempdir;
use reqwest::Client;

/// Represents the overall structure of a modrinth.index.json file.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")] // Modrinth uses camelCase for this file
pub struct ModrinthIndex {
    pub format_version: u32, // Usually 1
    pub game: String,        // e.g., "minecraft"
    pub version_id: String,  // Pack version identifier
    pub name: String,        // Pack name
    pub summary: Option<String>, // Optional description
    pub files: Vec<ModrinthIndexFile>,
    pub dependencies: HashMap<String, String>, // Key: dependency ID (e.g., "minecraft", "fabric-loader"), Value: version string
}

/// Represents a file entry within the modrinth.index.json.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthIndexFile {
    pub path: String, // Target path within the instance (e.g., "mods/fabric-api.jar")
    pub hashes: HashMap<String, String>, // Key: hash algorithm ("sha1", "sha512"), Value: hash string
    pub env: Option<HashMap<String, String>>, // Environment constraints ("client", "server")
    pub downloads: Vec<String>, // List of download URLs
    pub file_size: u64, // File size in bytes
}

// Constants for common dependency keys
pub const MINECRAFT_DEPENDENCY: &str = "minecraft";
pub const FORGE_DEPENDENCY: &str = "forge";
pub const FABRIC_LOADER_DEPENDENCY: &str = "fabric-loader";
pub const QUILT_LOADER_DEPENDENCY: &str = "quilt-loader";
pub const NEOFORGE_DEPENDENCY: &str = "neoforge";

/// Determines the ModLoader and its version from the manifest dependencies.
fn determine_loader_from_dependencies(dependencies: &HashMap<String, String>) -> (ModLoader, Option<String>) {
    if let Some(version) = dependencies.get(FABRIC_LOADER_DEPENDENCY) {
        (ModLoader::Fabric, Some(version.clone()))
    } else if let Some(version) = dependencies.get(QUILT_LOADER_DEPENDENCY) {
        (ModLoader::Quilt, Some(version.clone()))
    } else if let Some(version) = dependencies.get(FORGE_DEPENDENCY) {
        (ModLoader::Forge, Some(version.clone()))
    } else if let Some(version) = dependencies.get(NEOFORGE_DEPENDENCY) {
        (ModLoader::NeoForge, Some(version.clone()))
    } else {
        // No specific loader found, assume Vanilla
        (ModLoader::Vanilla, None)
    }
}

/// Processes a .mrpack file asynchronously using the BufReader<File> approach.
/// Reads the manifest and extracts basic information to create a *potential* Profile struct
/// and returns the parsed manifest data.
pub async fn process_mrpack(pack_path: PathBuf) -> Result<(Profile, ModrinthIndex)> {
    info!("Processing mrpack file: {:?}", pack_path);

    // 1. Open the file asynchronously and wrap in BufReader
    let file = File::open(&pack_path).await.map_err(|e| {
        error!("Failed to open mrpack file {:?}: {}", pack_path, e);
        AppError::Io(e)
    })?;
    let mut buf_reader = BufReader::new(file);

    // 2. Create async zip reader using with_tokio
    let mut zip = ZipFileReader::with_tokio(&mut buf_reader).await.map_err(|e| {
        error!("Failed to read zip archive {:?} with tokio reader: {}", pack_path, e);
        AppError::Other(format!("Failed to read mrpack zip with tokio reader: {}", e))
    })?;

    // 3. Find and read modrinth.index.json
    let entries = zip.file().entries();
    let manifest_entry_index = entries
        .iter()
        .position(|e| e.filename().as_str().map_or(false, |name| name == "modrinth.index.json"))
        .ok_or_else(|| {
            error!("modrinth.index.json not found in archive: {:?}", pack_path);
            AppError::Other("modrinth.index.json not found in archive".into())
        })?;

    let manifest_content = {
        let mut entry_reader = zip.reader_with_entry(manifest_entry_index).await.map_err(|e| {
            error!("Failed to get entry reader for manifest: {}", e);
            AppError::Other(format!("Failed to read manifest entry: {}", e))
        })?;
        
        let mut buffer = Vec::new();
        entry_reader.read_to_end_checked(&mut buffer).await.map_err(|e| {
            error!("Failed to read manifest content to buffer: {}", e);
            AppError::Other(format!("Zip entry read error: {}", e)) 
        })?;
        
        String::from_utf8(buffer).map_err(|e| {
            error!("Failed to convert manifest buffer to string: {}", e);
            AppError::Other(format!("Manifest content is not valid UTF-8: {}", e))
        })?
    };

    // 4. Parse the manifest
    let manifest: ModrinthIndex = serde_json::from_str(&manifest_content).map_err(|e| {
        error!("Failed to parse modrinth.index.json: {}", e);
        AppError::Json(e)
    })?;
    info!("Parsed manifest for pack: '{}'", manifest.name);

    // 5. Determine requirements (MC Version, Loader)
    let game_version = manifest
        .dependencies
        .get(MINECRAFT_DEPENDENCY)
        .ok_or_else(|| {
            error!("Manifest for '{}' missing Minecraft dependency", manifest.name);
            AppError::Other("Missing Minecraft dependency in manifest".into())
        })?
        .clone();

    let (loader, loader_version) = determine_loader_from_dependencies(&manifest.dependencies);
    
    info!("Determined requirements: MC={}, Loader={:?}, LoaderVersion={:?}", 
          game_version, loader, loader_version);

    // 6. Create a potential Profile object (not saved)
    let profile_name = manifest.name.clone();
    let placeholder_id = Uuid::new_v4();
    let potential_path_segment = sanitize(&profile_name);
    let potential_path = format!("{}", potential_path_segment);

    let profile = Profile {
        id: placeholder_id,
        name: profile_name,
        path: potential_path, 
        game_version,
        loader,
        loader_version,
        created: Utc::now(),
        last_played: None,
        settings: ProfileSettings::default(),
        state: ProfileState::NotInstalled,
        mods: Vec::new(),
        selected_norisk_pack_id: None,
        disabled_norisk_mods_detailed: HashSet::new(),
        source_standard_profile_id: None,
        group: Some("MODPACKS".to_string()),    
        is_standard_version: false,
        norisk_information: None,
    };

    info!("Prepared potential profile object for '{}'", profile.name);

    Ok((profile, manifest))
}

/// Takes a parsed ModrinthIndex manifest and resolves the file entries
/// against the Modrinth API (using hashes) to create a list of Mod structs.
/// Determines the pack loader from the manifest dependencies.
pub async fn resolve_manifest_files(
    manifest: &ModrinthIndex 
) -> Result<Vec<Mod>> {
    // Determine loader internally using the helper function
    let (pack_loader, _) = determine_loader_from_dependencies(&manifest.dependencies);
    
    info!("Resolving {} files from manifest '{}' against Modrinth API (Determined Loader: {:?})...", 
        manifest.files.len(), manifest.name, pack_loader);

    let game_version = manifest
        .dependencies
        .get(MINECRAFT_DEPENDENCY)
        .ok_or_else(|| {
            error!("Manifest for '{}' missing Minecraft dependency", manifest.name);
            AppError::Other("Missing Minecraft dependency in manifest".into())
        })?
        .clone();

    let mut mods_to_add = Vec::new();
    let mut hashes_to_lookup = Vec::new();
    let mut file_info_map: HashMap<String, &ModrinthIndexFile> = HashMap::new(); 

    for file_data in &manifest.files {
        let is_client_required = file_data.env.as_ref()
            .and_then(|env| env.get("client"))
            .map_or(true, |req| req == "required" || req == "optional");
            
        if !is_client_required {
            continue;
        }

        if let Some(hash) = file_data.hashes.get("sha1") {
            if hash.len() == 40 { 
                hashes_to_lookup.push(hash.clone());
                file_info_map.insert(hash.clone(), file_data);
            } else {
                warn!("Invalid sha1 hash found for {}: {}", file_data.path, hash);
            }
        } else {
            warn!("No sha1 hash found for file: {}. Cannot resolve.", file_data.path);
        }
    }

    if hashes_to_lookup.is_empty() {
        info!("No valid sha1 hashes found for client files. No mods to resolve.");
        return Ok(mods_to_add);
    }

    // 2. Call Modrinth API (Batch Hash Lookup)
    info!("Looking up Modrinth info for {} sha1 hashes...", hashes_to_lookup.len());
    let versions_map = match modrinth::get_versions_by_hashes(hashes_to_lookup.clone(), "sha1").await {
        Ok(map) => map,
        Err(e) => {
            error!("Failed to get version info by hashes: {}", e);
            return Err(e);
        }
    };
    info!("Received Modrinth info for {} hashes.", versions_map.len());

    // 3. Create Mod structs from the results
    for (hash, version_info) in versions_map {
        if let Some(original_file_info) = file_info_map.get(&hash) {
            let primary_file = version_info.files.iter().find(|f| f.primary)
                .or_else(|| version_info.files.first());

            if let Some(file_details) = primary_file {
                if file_details.hashes.sha1.as_deref() != Some(hash.as_str()) {
                     warn!("SHA1 hash mismatch for file {} (Manifest: {}, API: {:?}). Skipping.", 
                           original_file_info.path, hash, file_details.hashes.sha1);
                     continue;
                }

                let mod_source = ModSource::Modrinth {
                    project_id: version_info.project_id.clone(),
                    version_id: version_info.id.clone(),
                    file_name: file_details.filename.clone(), 
                    download_url: original_file_info.downloads.first().cloned().unwrap_or_else(|| {
                         warn!("Missing download URL in manifest for file: {}. Using API URL as fallback.", original_file_info.path);
                         file_details.url.clone()
                    }),
                    file_hash_sha1: Some(hash.clone()),
                };

                let new_mod = Mod {
                    id: Uuid::new_v4(), 
                    source: mod_source,
                    enabled: !original_file_info.path.ends_with(".disabled"), 
                    display_name: Some(version_info.name.clone()),
                    version: Some(version_info.version_number.clone()),
                    game_versions: Some(vec![game_version.clone()]),
                    file_name_override: None, 
                    associated_loader: Some(pack_loader),
                };

                info!("Prepared Mod struct for: {} (Enabled: {}, Loader: {:?})", 
                    new_mod.display_name.as_deref().unwrap_or("Unknown"), 
                    new_mod.enabled,
                    new_mod.associated_loader
                );
                mods_to_add.push(new_mod);

            } else {
                error!("Could not find primary file details in API response for version {} (from hash {}). Cannot create Mod.", version_info.id, hash);
            }
        } else {
            warn!("Internal inconsistency: Resolved hash {} not found in original file map.", hash);
        }
    }

    info!("Successfully resolved {} mods from the manifest.", mods_to_add.len());
    Ok(mods_to_add)
}

/// Extracts files from the "overrides" directory within a .mrpack archive
/// into the specified target profile directory, strictly following the extract_data_folder pattern.
pub async fn extract_mrpack_overrides(
    pack_path: &Path,
    profile: &Profile,
) -> Result<()> {
    info!("Extracting overrides for profile '{}' from {:?}", profile.name, pack_path);
    // Get the state manager instance
    let state_manager = State::get().await?;
    // Use the new method that takes the profile directly
    let target_dir = state_manager.profile_manager.calculate_instance_path_for_profile(profile)?;
    info!("Target profile directory calculated as: {:?}", target_dir);

    if !target_dir.exists() {
        info!("Target profile directory does not exist, creating: {:?}", target_dir);
        fs::create_dir_all(&target_dir).await.map_err(|e| {
            error!("Failed to create target profile directory {:?}: {}", target_dir, e);
            AppError::Io(e)
        })?;
    }

    // Open the file and wrap in BufReader
    let file = File::open(pack_path).await.map_err(|e| {
        error!("Failed to open mrpack file {:?}: {}", pack_path, e);
        AppError::Io(e)
    })?;
    let mut buf_reader = BufReader::new(file);

    // Initialize ZipFileReader
    let mut zip = ZipFileReader::with_tokio(&mut buf_reader).await.map_err(|e| {
        error!("Failed to read mrpack as ZIP: {}", e);
        AppError::Other(format!("Failed to read mrpack zip: {}", e))
    })?;

    // Get length once
    let num_entries = zip.file().entries().len();
    info!("Found {} entries in the zip archive.", num_entries);

    for index in 0..num_entries {
        // --- Start of immutable borrow scope ---
        let entry = match zip.file().entries().get(index) {
             Some(e) => e,
             None => { // This should ideally not happen if index is valid
                 error!("Failed to get zip entry metadata for index {}", index);
                 continue;
            }
        };
        let original_file_name = match entry.filename().as_str() {
             Ok(s) => s,
             Err(_) => { error!("Non UTF-8 filename at index {}", index); continue; }
        };

        // Extract all needed metadata *now*
        let is_override = original_file_name.starts_with("overrides/");
        let is_directory = original_file_name.ends_with('/');
        // Get size only if needed (i.e., it's a file)
        let uncompressed_size = if is_override && !is_directory {
            entry.uncompressed_size() as usize
        } else {
            0 // Default value, won't be used if it's a directory
        };
        // Clone the filename string to own it
        let owned_filename = original_file_name.to_string();
        // --- End of immutable borrow scope ---


        // Now use the owned/copied metadata
        if is_override {
            let relative_path_in_overrides = match owned_filename.strip_prefix("overrides/") {
                Some(p) if !p.is_empty() => p,
                _ => continue,
            };
            let final_dest_path = target_dir.join(relative_path_in_overrides);

            if is_directory {
                // Directory Creation
                if !final_dest_path.exists() {
                    info!("Creating directory: {:?}", final_dest_path);
                    fs::create_dir_all(&final_dest_path).await.map_err(|e| {
                        error!("Failed to create directory {:?}: {}", final_dest_path, e);
                        AppError::Io(e)
                    })?;
                }
            } else {
                // File Extraction
                info!("Extracting override file: '{}' -> {:?}", owned_filename, final_dest_path);
                 if let Some(parent) = final_dest_path.parent() {
                    if !fs::try_exists(parent).await? {
                        info!("Creating parent directory: {:?}", parent);
                        fs::create_dir_all(parent).await.map_err(|e| {
                            error!("Failed to create parent directory {:?}: {}", parent, e);
                            AppError::Io(e)
                        })?;
                    }
                 }

                // Get reader MUTABLY (should work now as 'entry' ref is out of scope)
                let mut entry_reader = zip.reader_with_entry(index).await.map_err(|e| {
                    error!("Failed to get reader for zip entry '{}': {}", owned_filename, e);
                    AppError::Other(format!("Failed to read zip entry {}: {}", index, e))
                })?;
                let mut writer = fs::File::create(&final_dest_path).await.map_err(|e| {
                    error!("Failed to create destination file {:?}: {}", final_dest_path, e);
                    AppError::Io(e)
                })?;

                // Read/Write using the extracted 'uncompressed_size'
                let mut buffer = Vec::with_capacity(uncompressed_size);
                entry_reader.read_to_end_checked(&mut buffer).await.map_err(|e| {
                    error!("Failed to read zip entry content '{}': {}", owned_filename, e);
                    AppError::Other(format!("Failed to read zip entry content (checked): {}", e))
                 })?;
                writer.write_all(&buffer).await.map_err(|e| {
                    error!("Failed to write content to {:?}: {}", final_dest_path, e);
                    AppError::Io(e)
                })?;
                info!("Successfully extracted to: {}", final_dest_path.display());
            }
        }
    }

    info!("Finished extracting overrides for profile '{}'.", profile.name);
    Ok(())
}

pub async fn test_mrpack_processing() -> Result<()> {
     println!("Starting full mrpack processing test.");

    // --- Robuste Pfadberechnung ---
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir.parent().expect("Failed to get parent directory of CARGO_MANIFEST_DIR");
    println!("Calculated Project Root: {:?}", project_root);

    let relative_pack_path = "minecraft-data/modrinth/cc-community.mrpack"; // Relativ zum Projekt-Root
    let absolute_pack_path = project_root.join(relative_pack_path);

    println!("Calculated absolute path for .mrpack: {:?}", absolute_pack_path);

    // --- Existenzprüfung (optional, aber gut zur Fehlersuche) ---
    if !absolute_pack_path.exists() {
        let err_msg = format!(
            "Test prerequisite failed: Hardcoded .mrpack file not found at calculated path: {:?}. Check relative path '{}' and project structure.",
            absolute_pack_path,
            relative_pack_path
        );
        eprintln!("Error: {}", err_msg);
        // Test fehlschlagen lassen statt assert!, da es eine Voraussetzung ist
        return Err(AppError::Other(err_msg));
    }
    println!("Found .mrpack file at: {:?}", absolute_pack_path);

    // --- Datei verarbeiten: Profil-Basis und Manifest holen ---
    println!("Calling process_mrpack...");
    let (mut profile, manifest) = process_mrpack(absolute_pack_path.clone()).await?; // Klonen, falls Pfad nochmal gebraucht wird
    println!("process_mrpack successful. Profile Name: '{}', MC Version: {}", profile.name, profile.game_version);
    assert!(!profile.name.is_empty(), "Profile name should not be empty after process_mrpack");

    // --- Mods auflösen ---
    println!("Calling resolve_manifest_files...");
    let resolved_mods = resolve_manifest_files(&manifest).await?;
    println!("resolve_manifest_files successful. Resolved {} mods.", resolved_mods.len());

    // --- Mods zuweisen und abschließende Prüfung ---
    profile.mods = resolved_mods;

    println!("Profile: {:#?}", profile);

    // Print the resolved mods (now part of the profile)
    println!("Resolved mods details: {:#?}", profile.mods.first());

    // Print the final profile struct
    //println!("Final profile object: {:#?}", profile); // Use {:#?} for pretty-printing

    // Assertions
    assert!(!profile.name.is_empty(), "Profile name should not be empty after process_mrpack");
    assert!(!profile.mods.is_empty(), "Expected to resolve at least one mod.");
    println!("Successfully processed mrpack and resolved mods for profile '{}'. Found {} mods.", profile.name, profile.mods.len());

    extract_mrpack_overrides(&absolute_pack_path, &profile).await?;

    return Ok(()); 
}

/// Imports a profile from a .mrpack file, processing, resolving, extracting, and saving it.
pub async fn import_mrpack_as_profile(pack_path: PathBuf) -> Result<Uuid> {
    info!("Starting full import process for mrpack: {:?}", pack_path);

    // 1. Process mrpack to get base profile and manifest
    let (mut profile, manifest) = process_mrpack(pack_path.clone()).await?;
    info!("Successfully processed mrpack manifest for '{}'.", profile.name);

    // 2. Resolve mods from manifest files
    let resolved_mods = resolve_manifest_files(&manifest).await?;
    info!("Successfully resolved {} mods from manifest.", resolved_mods.len());
    profile.mods = resolved_mods;

    // 3. Determine unique profile path segment (similar to create_profile command)
    let base_profiles_dir = crate::state::profile_state::default_profile_path();
    let sanitized_base_name = sanitize(&profile.name);
    if sanitized_base_name.is_empty() {
        // Handle potential empty name after sanitization (e.g., use default or error)
        let default_name = format!("imported-pack-{}", Utc::now().timestamp_millis());
        warn!("Profile name '{}' became empty after sanitization. Using default: {}", profile.name, default_name);
        profile.name = default_name.clone(); // Use the default name for the profile name too
        let unique_segment = crate::utils::path_utils::find_unique_profile_segment(&base_profiles_dir, &profile.name).await?;
        profile.path = unique_segment;
    } else {
        let unique_segment = crate::utils::path_utils::find_unique_profile_segment(&base_profiles_dir, &sanitized_base_name).await?;
        profile.path = unique_segment; // Update the profile path
    }
    info!("Determined unique profile directory segment: {}", profile.path);
    
    // Ensure the target profile directory exists before extraction
    let target_dir = base_profiles_dir.join(&profile.path);
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).await.map_err(|e| {
            error!("Failed to create target profile directory {:?}: {}", target_dir, e);
            AppError::Io(e)
        })?;
    }

    // 4. Extract overrides to the *correct* final profile location
    info!("Extracting overrides to profile directory: {:?}", target_dir);
    // Use the absolute path to the pack file for extraction
    extract_mrpack_overrides(&pack_path, &profile).await?; 
    info!("Successfully extracted overrides.");

    // 5. Save the profile using ProfileManager via State
    let state = State::get().await?;
    info!("Saving the new profile '{}' (ID: {})...", profile.name, profile.id);
    let profile_id = state.profile_manager.create_profile(profile).await?; // Use create_profile
    info!("Successfully created and saved profile with ID: {}", profile_id);

    Ok(profile_id) // Return the ID of the created profile
}

/// Downloads a modpack from a URL and returns the temporary file path
pub async fn download_and_process_mrpack(
    download_url: &str,
    file_name: &str,
) -> Result<Uuid> {
    info!("Downloading modpack from URL: {}", download_url);
    
    // Create a temporary directory
    let temp_dir = tempdir().map_err(|e| {
        error!("Failed to create temporary directory: {}", e);
        AppError::Other(format!("Failed to create temporary directory: {}", e))
    })?;
    
    let temp_file_path = temp_dir.path().join(file_name);
    debug!("Temporary file path for downloaded modpack: {:?}", temp_file_path);
    
    // Create HTTP client
    let client = Client::new();
    
    // Download the file
    let response = client
        .get(download_url)
        .header(
            "User-Agent",
            format!(
                "NoRiskClient-Launcher/{} (support@norisk.gg)",
                env!("CARGO_PKG_VERSION")
            ),
        )
        .send()
        .await
        .map_err(|e| {
            error!("Failed to download modpack: {}", e);
            AppError::Download(format!("Failed to download modpack: {}", e))
        })?;
    
    if !response.status().is_success() {
        return Err(AppError::Download(format!(
            "Failed to download modpack: HTTP {}",
            response.status()
        )));
    }
    
    // Get the bytes
    let bytes = response
        .bytes()
        .await
        .map_err(|e| {
            error!("Failed to read modpack bytes: {}", e);
            AppError::Download(format!("Failed to read modpack bytes: {}", e))
        })?;
    
    // Write the file to temporary location
    let mut file = File::create(&temp_file_path)
        .await
        .map_err(|e| {
            error!("Failed to create temporary file: {}", e);
            AppError::Io(e)
        })?;
    
    file.write_all(&bytes)
        .await
        .map_err(|e| {
            error!("Failed to write downloaded data to temporary file: {}", e);
            AppError::Io(e)
        })?;
    
    debug!("Successfully downloaded modpack to temporary file: {:?}", temp_file_path);
    
    // Import the modpack and get profile ID
    let profile_id = import_mrpack_as_profile(temp_file_path.clone()).await?;
    info!("Successfully imported modpack as new profile with ID: {}", profile_id);
    
    // Keep the temp directory alive until we're done (will be cleaned up when it goes out of scope)
    // We intentionally drop the TempDir at the end of this function to clean up
    drop(temp_dir); 
    
    // Return the profile ID
    Ok(profile_id)
}
