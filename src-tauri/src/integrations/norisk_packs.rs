use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{PathBuf, Path};
use tokio::fs::File;
use tokio::io::{BufReader, AsyncWriteExt};
use async_zip::tokio::read::seek::ZipFileReader;
use crate::error::{AppError, Result};
use uuid::Uuid;
use chrono::Utc;
use crate::state::profile_state::{Profile, ProfileSettings, ProfileState, ModLoader};
use crate::state::state_manager::State;
use tokio::fs;
use log::{info, error, warn, debug};
use sanitize_filename::sanitize;
use std::collections::HashSet;
use tempfile::tempdir;
use reqwest::Client;
use crate::utils::profile_utils::copy_dir_recursively;

/// Represents the overall structure of the norisk_modpacks.json file.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoriskModpacksConfig {
    /// A map where the key is the pack ID (e.g., "norisk-prod") and the value is the pack definition.
    pub packs: HashMap<String, NoriskPackDefinition>,
    /// A map defining Maven repositories used by mods with source type "maven".
    /// Key is a reference name (e.g., "noriskproduction"), value is the repository URL.
    #[serde(default)] // Allow missing repositories section if no maven mods are used
    pub repositories: HashMap<String, String>,
}

/// Defines a single Norisk modpack variant (e.g., production, development).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoriskPackDefinition {
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub description: String,
    /// Optional: List of pack IDs this pack inherits mods from. Processed in order.
    #[serde(rename = "inheritsFrom", default)]
    pub inherits_from: Option<Vec<String>>,
    /// Optional: List of mod IDs to exclude after inheritance and local mods are combined.
    #[serde(rename = "excludeMods", default)]
    pub exclude_mods: Option<Vec<String>>,
    /// Optional: List of mods specifically defined for this pack. These override inherited mods.
    #[serde(default)]
    pub mods: Vec<NoriskModEntryDefinition>,
}

/// Defines a single mod entry within a Norisk pack definition.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoriskModEntryDefinition {
    /// Unique internal identifier for the mod (e.g., "sodium"). Should be consistent across packs.
    pub id: String,
    /// Optional display name for the UI.
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    /// Defines the general source type and information needed to locate the mod.
    pub source: NoriskModSourceDefinition,
    /// Defines which specific version of the mod to use based on Minecraft version and loader.
    /// The value format depends on the `source.type`.
    pub compatibility: CompatibilityMap,
}

/// Defines the general source of a Norisk mod.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum NoriskModSourceDefinition {
    Modrinth {
        /// The stable, unique, often alphanumeric Modrinth project ID (e.g., "AANobbMI"). Used for API calls and matching.
        #[serde(rename = "projectId")]
        project_id: String,
        /// The user-friendly slug used in URLs and Maven artifact IDs (e.g., "sodium").
        #[serde(rename = "projectSlug")]
        project_slug: String,
    },
    Maven {
        /// Key referencing the URL in the top-level `repositories` map.
        #[serde(rename = "repositoryRef")]
        repository_ref: String,
        /// Optional: Can be specified if consistent across versions.
        #[serde(rename = "groupId")]
        group_id: String,
        /// Optional: Can be specified if consistent across versions.
        #[serde(rename = "artifactId")]
        artifact_id: String,
    },
    Url, // No additional data needed, URL comes from compatibility map.
}

/// Struct to hold compatibility target details
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CompatibilityTarget {
    /// The identifier used to locate the specific version (e.g., URL, Maven version, Modrinth version ID).
    pub identifier: String,
    /// The desired filename for the mod in the cache and mods folder (optional).
    pub filename: Option<String>,
}

/// Type alias for the compatibility map: McVersion -> Loader -> CompatibilityTarget
/// Example: {"1.8.9": {"vanilla": {"identifier": "URL", "filename": "OptiFine...jar"}}}
pub type CompatibilityMap = HashMap<String, HashMap<String, CompatibilityTarget>>;

/// Helper function to determine the definitive filename for a mod defined within a Norisk Pack.
/// Prioritizes the filename specified in the compatibility target, otherwise derives it for known types.
/// Returns an error if the filename cannot be determined (e.g., missing in target for URL mods).
pub fn get_norisk_pack_mod_filename(
    source: &NoriskModSourceDefinition,
    target: &CompatibilityTarget,
    mod_id_for_log: &str, // For better error messages
) -> crate::error::Result<String> { // Use crate::error::Result
    match target.filename {
        Some(ref fname) => Ok(fname.clone()),
        None => { // Derive filename if not provided
            match source {
                NoriskModSourceDefinition::Modrinth { project_slug, .. } => {
                    Ok(format!("{}-{}.jar", project_slug, target.identifier))
                }
                NoriskModSourceDefinition::Maven { artifact_id, .. } => {
                    Ok(format!("{}-{}.jar", artifact_id, target.identifier))
                }
                NoriskModSourceDefinition::Url { .. } => {
                    // Require filename for URL mods in pack definition
                    Err(crate::error::AppError::Other(format!(
                        "Filename missing in pack definition compatibility target for URL mod '{}'",
                        mod_id_for_log
                    )))
                }
                // Add handling for other source types if they are added later
            }
        }
    }
}

/// Imports a profile from a .noriskpack file.
/// This function reads profile.json, creates a new profile, and extracts overrides.
pub async fn import_noriskpack_as_profile(pack_path: PathBuf) -> Result<Uuid> {
    info!("Starting import process for noriskpack: {:?}", pack_path);

    // 1. Open the file and create a reader
    let file = File::open(&pack_path).await.map_err(|e| {
        error!("Failed to open noriskpack file {:?}: {}", pack_path, e);
        AppError::Io(e)
    })?;
    let mut buf_reader = BufReader::new(file);

    // 2. Create zip reader
    let mut zip = ZipFileReader::with_tokio(&mut buf_reader).await.map_err(|e| {
        error!("Failed to read noriskpack as ZIP: {}", e);
        AppError::Other(format!("Failed to read noriskpack zip: {}", e))
    })?;

    // 3. Find and read profile.json
    let entries = zip.file().entries();
    let profile_entry_index = entries
        .iter()
        .position(|e| e.filename().as_str().map_or(false, |name| name == "profile.json"))
        .ok_or_else(|| {
            error!("profile.json not found in archive: {:?}", pack_path);
            AppError::Other("profile.json not found in archive".into())
        })?;

    let profile_content = {
        let mut entry_reader = zip.reader_with_entry(profile_entry_index).await.map_err(|e| {
            error!("Failed to get entry reader for profile.json: {}", e);
            AppError::Other(format!("Failed to read profile.json entry: {}", e))
        })?;
        
        let mut buffer = Vec::new();
        entry_reader.read_to_end_checked(&mut buffer).await.map_err(|e| {
            error!("Failed to read profile.json content: {}", e);
            AppError::Other(format!("Zip entry read error: {}", e)) 
        })?;
        
        String::from_utf8(buffer).map_err(|e| {
            error!("Failed to convert profile.json to string: {}", e);
            AppError::Other(format!("profile.json content is not valid UTF-8: {}", e))
        })?
    };

    // 4. Parse the profile.json
    let mut exported_profile: Profile = serde_json::from_str(&profile_content).map_err(|e| {
        error!("Failed to parse profile.json: {}", e);
        AppError::Json(e)
    })?;
    
    // 5. Use the filename as the profile name if available
    if let Some(file_name) = pack_path.file_stem().and_then(|s| s.to_str()) {
        info!("Using noriskpack filename as profile name: {}", file_name);
        exported_profile.name = file_name.to_string();
    }
    
    info!("Parsed profile data: Name='{}', Game Version={}, Loader={:?}", 
        exported_profile.name, exported_profile.game_version, exported_profile.loader);

    // 6. Create a new profile with a unique path
    let base_profiles_dir = crate::state::profile_state::default_profile_path();
    let sanitized_base_name = sanitize(&exported_profile.name);
    if sanitized_base_name.is_empty() {
        // Handle empty name after sanitization
        let default_name = format!("imported-noriskpack-{}", Utc::now().timestamp_millis());
        warn!("Profile name '{}' became empty after sanitization. Using default: {}", 
            exported_profile.name, default_name);
        exported_profile.name = default_name.clone();
    }
    
    // Find a unique path segment
    let unique_segment = crate::utils::path_utils::find_unique_profile_segment(
        &base_profiles_dir, 
        &sanitized_base_name
    ).await?;
    
    // Update the profile with new values
    exported_profile.path = unique_segment;
    exported_profile.id = Uuid::new_v4(); // Generate a new UUID
    exported_profile.created = Utc::now(); // Set creation time to now
    exported_profile.last_played = None;
    exported_profile.state = ProfileState::NotInstalled;
    
    info!("Prepared new profile with path: {}", exported_profile.path);

    // 7. Ensure the target profile directory exists
    let target_dir = base_profiles_dir.join(&exported_profile.path);
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).await.map_err(|e| {
            error!("Failed to create target profile directory {:?}: {}", target_dir, e);
            AppError::Io(e)
        })?;
    }

    // 8. Extract the overrides directory
    info!("Extracting overrides to profile directory: {:?}", target_dir);
    let num_entries = zip.file().entries().len();
    
    for index in 0..num_entries {
        let entry = match zip.file().entries().get(index) {
            Some(e) => e,
            None => continue,
        };
        
        let original_file_name = match entry.filename().as_str() {
            Ok(s) => s,
            Err(_) => { 
                error!("Non UTF-8 filename at index {}", index); 
                continue; 
            }
        };

        let is_override = original_file_name.starts_with("overrides/");
        let is_directory = original_file_name.ends_with('/');
        let uncompressed_size = if is_override && !is_directory {
            entry.uncompressed_size() as usize
        } else {
            0
        };
        
        let owned_filename = original_file_name.to_string();

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

                // Extract file content
                let mut entry_reader = zip.reader_with_entry(index).await.map_err(|e| {
                    error!("Failed to get reader for zip entry '{}': {}", owned_filename, e);
                    AppError::Other(format!("Failed to read zip entry {}: {}", index, e))
                })?;
                
                let mut writer = fs::File::create(&final_dest_path).await.map_err(|e| {
                    error!("Failed to create destination file {:?}: {}", final_dest_path, e);
                    AppError::Io(e)
                })?;

                let mut buffer = Vec::with_capacity(uncompressed_size);
                entry_reader.read_to_end_checked(&mut buffer).await.map_err(|e| {
                    error!("Failed to read zip entry content '{}': {}", owned_filename, e);
                    AppError::Other(format!("Failed to read zip entry content: {}", e))
                })?;
                
                writer.write_all(&buffer).await.map_err(|e| {
                    error!("Failed to write content to {:?}: {}", final_dest_path, e);
                    AppError::Io(e)
                })?;
                
                info!("Successfully extracted to: {}", final_dest_path.display());
            }
        }
    }

    info!("Successfully extracted overrides.");

    // 9. Save the profile using ProfileManager
    let state = State::get().await?;
    let profile_id = state.profile_manager.create_profile(exported_profile).await?;
    info!("Successfully created and saved profile with ID: {}", profile_id);

    Ok(profile_id)
}

impl NoriskModpacksConfig {
    pub fn resolve_pack_mods(
        &self,
        pack_id: &str,
        visited: &mut HashSet<String>, // To detect circular inheritance
    ) -> Result<Vec<NoriskModEntryDefinition>> {
        // --- 1. Circular Dependency Check ---
        if !visited.insert(pack_id.to_string()) {
            error!("Circular inheritance detected involving pack ID: {}", pack_id);
            return Err(AppError::Other(format!(
                "Circular inheritance detected involving pack ID: {}",
                pack_id
            )));
        }

        // --- 2. Get Base Definition ---
        let base_definition = self.packs.get(pack_id).ok_or_else(|| {
            error!("Pack ID '{}' not found in configuration.", pack_id);
            AppError::Other(format!("Pack ID '{}' not found", pack_id))
        })?;

        // --- 3. Initialize Mod Map ---
        // Use HashMap to handle overrides easily (Mod ID -> Mod Definition)
        let mut resolved_mods: HashMap<String, NoriskModEntryDefinition> = HashMap::new();

        // --- 4. Handle Inheritance ---
        if let Some(parent_ids) = &base_definition.inherits_from {
            for parent_id in parent_ids {
                debug!("Pack '{}': Inheriting from parent '{}'", pack_id, parent_id);
                // Recursively resolve parent mods
                let parent_mods = self.resolve_pack_mods(parent_id, visited)?;
                // Merge parent mods into the map. Later parents override earlier ones.
                for mod_entry in parent_mods {
                    resolved_mods.insert(mod_entry.id.clone(), mod_entry);
                }
            }
        }

        // --- 5. Handle Local Mods ---
        // Local mods defined directly in the pack override any inherited mods.
        if let local_mods = &base_definition.mods {
             debug!("Pack '{}': Processing {} local mods", pack_id, local_mods.len());
            for mod_entry in local_mods {
                resolved_mods.insert(mod_entry.id.clone(), mod_entry.clone());
            }
        }

        // --- 6. Handle Exclusions ---
        // Exclusions are applied *after* inheritance and local overrides.
        if let Some(excluded_mod_ids) = &base_definition.exclude_mods {
            debug!("Pack '{}': Applying {} exclusions", pack_id, excluded_mod_ids.len());
            for mod_id_to_exclude in excluded_mod_ids {
                if resolved_mods.remove(mod_id_to_exclude).is_some() {
                     debug!("Pack '{}': Excluded mod '{}'", pack_id, mod_id_to_exclude);
                } else {
                     warn!("Pack '{}': Exclusion requested for mod '{}', but it was not found in the resolved list.", pack_id, mod_id_to_exclude);
                }
            }
        }

        // --- 7. Finalize ---
        // Remove the current pack from the visited set for the current resolution path
        visited.remove(pack_id);

        // Convert the HashMap values back to a Vec
        let final_mod_list: Vec<NoriskModEntryDefinition> =
            resolved_mods.into_values().collect();
        
        debug!("Pack '{}': Resolved to {} final mods.", pack_id, final_mod_list.len());
        Ok(final_mod_list)
    }

    // Helper function to get a fully resolved pack definition (including mods)
    // This combines the base definition with the resolved mods.
     pub fn get_resolved_pack_definition(&self, pack_id: &str) -> Result<NoriskPackDefinition> {
        let base_definition = self.packs.get(pack_id).ok_or_else(|| {
            error!("Pack ID '{}' not found in configuration.", pack_id);
            AppError::Other(format!("Pack ID '{}' not found", pack_id))
        })?;

        let mut visited = HashSet::new();
        let resolved_mods_vec = self.resolve_pack_mods(pack_id, &mut visited)?;

        Ok(NoriskPackDefinition {
            display_name: base_definition.display_name.clone(),
            description: base_definition.description.clone(),
            inherits_from: base_definition.inherits_from.clone(), // Keep original inheritance info
            exclude_mods: base_definition.exclude_mods.clone(),   // Keep original exclusion info
            mods: resolved_mods_vec, // Use the fully resolved list here
        })
    }
}