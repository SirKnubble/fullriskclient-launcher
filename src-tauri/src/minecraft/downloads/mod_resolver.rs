use crate::error::Result;
use crate::integrations::norisk_packs::{self, NoriskModSourceDefinition, NoriskModpacksConfig};
use crate::state::profile_state::{
    self, CustomModInfo, ModLoader, ModSource, NoriskModIdentifier, Profile,
};
use log::{debug, info, warn};
use std::collections::HashMap;
use std::path::PathBuf;

// --- Struct for resolved mods ---
#[derive(Debug, Clone)]
pub struct TargetMod {
    // Make fields public so mod_downloader can access them
    pub mod_id: String, // Canonical Key (e.g., "modrinth:AANobbMI")
    pub filename: String,
    pub cache_path: PathBuf,
}

// --- Helper function to resolve the final list of mods (Focus on Modrinth) ---
// Renamed loader parameter to loader_str for clarity
pub async fn resolve_target_mods(
    profile: &Profile,
    norisk_config: Option<&NoriskModpacksConfig>,
    custom_mod_infos: Option<&[CustomModInfo]>,
    minecraft_version: &str,
    loader_str: &str,
    mod_cache_dir: &PathBuf,
) -> Result<Vec<TargetMod>> {
    let mut final_mods: HashMap<String, TargetMod> = HashMap::new(); // Key: Canonical Mod Identifier

    // --- Helper: Get Canonical Key ---
    fn get_canonical_key(source: &NoriskModSourceDefinition, mod_id: &str) -> Option<String> {
        match source {
            NoriskModSourceDefinition::Modrinth { project_id, .. } => {
                Some(format!("modrinth:{}", project_id))
            }
            NoriskModSourceDefinition::Url { .. } => Some(format!("url:{}", mod_id)),
            NoriskModSourceDefinition::Maven {
                group_id,
                artifact_id,
                ..
            } => Some(format!("maven:{}:{}", group_id, artifact_id)),
            // Add other types if needed
            _ => None,
        }
    }
    fn get_canonical_key_profile(source: &ModSource) -> Option<String> {
        match source {
            ModSource::Modrinth { project_id, .. } => Some(format!("modrinth:{}", project_id)),
            ModSource::Url { url, .. } => Some(format!("url:{}", url)),
            ModSource::Maven { coordinates, .. } => Some(format!("maven:{}", coordinates)),
            _ => None, // Ignore other types
        }
    }

    // 1. Process Pack Mods (Only Modrinth)
    if let (Some(ref pack_id), Some(config)) = (&profile.selected_norisk_pack_id, norisk_config) {
        info!("Resolving mods from selected Norisk Pack: '{}'", pack_id);
        match config.get_resolved_pack_definition(pack_id) {
            Ok(pack_definition) => {
                for mod_entry in &pack_definition.mods {
                    // --- START: Moved Disabled Check (Check *before* type/compatibility) ---
                    let mod_id_str = mod_entry.id.clone();
                    let game_version_str = minecraft_version.to_string();

                    match ModLoader::from_str(loader_str) {
                        Ok(loader_enum) => {
                            let identifier = NoriskModIdentifier {
                                pack_id: pack_id.clone(),
                                mod_id: mod_id_str.clone(),
                                game_version: game_version_str,
                                loader: loader_enum,
                            };

                            if profile.disabled_norisk_mods_detailed.contains(&identifier) {
                                info!(
                                    "Skipping pack mod '{}' (ID: {}) because it is disabled for profile '{}' context (MC: {}, Loader: {:?})",
                                    mod_entry.display_name.as_deref().unwrap_or("?"), mod_id_str, profile.name, minecraft_version, loader_enum
                                );
                                continue; // Skip this mod entirely if disabled
                            }
                            // Mod is not disabled for this context
                        }
                        Err(_) => {
                            warn!("Invalid loader string '{}' during disabled check for pack mod '{}'. Cannot check disabled status.", loader_str, mod_id_str);
                            // Proceeding even if loader check failed for disabled status?
                        }
                    }
                    // --- END: Moved Disabled Check ---

                    // --- Process the mod based on type (if not disabled) ---

                    // Current focus: Modrinth
                    if let NoriskModSourceDefinition::Modrinth { .. } = &mod_entry.source {
                        if let Some(target) = mod_entry
                            .compatibility
                            .get(minecraft_version)
                            .and_then(|l| l.get(loader_str))
                        {
                            // Disabled check is handled above
                            if let Some(canonical_key) =
                                get_canonical_key(&mod_entry.source, &mod_entry.id)
                            {
                                match norisk_packs::get_norisk_pack_mod_filename(
                                    &mod_entry.source,
                                    target,
                                    &mod_entry.id,
                                ) {
                                    Ok(filename) => {
                                        let cache_path = mod_cache_dir.join(&filename);
                                        if cache_path.exists() {
                                            final_mods.insert(
                                                canonical_key.clone(),
                                                TargetMod {
                                                    mod_id: canonical_key,
                                                    filename,
                                                    cache_path,
                                                },
                                            );
                                        } else {
                                            warn!(
                                            "Modrinth mod '{}' defined in pack '{}' not found in cache at: {:?}. Skipping.", 
                                            filename, pack_id, cache_path
                                        );
                                        }
                                    }
                                    Err(e) => {
                                        warn!(
                                         "Could not determine filename for pack Modrinth mod '{}' (ID: {}): {}. Skipping.",
                                         mod_entry.display_name.as_deref().unwrap_or(&mod_entry.id), mod_entry.id, e
                                    );
                                    }
                                } // End get_filename match
                            } // End get_canonical_key match
                        } // End compatibility check

                    // Handle URL Mods
                    } else if let NoriskModSourceDefinition::Url { .. } = &mod_entry.source {
                        if let Some(target) = mod_entry
                            .compatibility
                            .get(minecraft_version)
                            .and_then(|l| l.get(loader_str))
                        {
                            // Disabled check is handled above
                            if let Some(canonical_key) =
                                get_canonical_key(&mod_entry.source, &mod_entry.id)
                            {
                                match norisk_packs::get_norisk_pack_mod_filename(
                                    &mod_entry.source,
                                    target,
                                    &mod_entry.id,
                                ) {
                                    Ok(filename) => {
                                        let cache_path = mod_cache_dir.join(&filename);
                                        if cache_path.exists() {
                                            // Use the filename from the compatibility block
                                            final_mods.insert(
                                                canonical_key.clone(),
                                                TargetMod {
                                                    mod_id: canonical_key,
                                                    filename: filename.clone(), // Use the explicit filename
                                                    cache_path,
                                                },
                                            );
                                            info!("Resolved URL mod '{}' from pack.", filename);
                                        } else {
                                            warn!(
                                            "URL mod '{}' defined in pack '{}' not found in cache at: {:?}. Skipping.",
                                            filename, pack_id, cache_path
                                        );
                                        }
                                    }
                                    Err(e) => {
                                        // Should only happen if filename is missing in pack def
                                        warn!(
                                        "Could not get filename for pack URL mod '{}' (ID: {}): {}. Skipping.",
                                        mod_entry.display_name.as_deref().unwrap_or(&mod_entry.id), mod_entry.id, e
                                    );
                                    }
                                } // End get_filename match
                            } // End get_canonical_key match
                        } // End compatibility check

                    // Handle Maven Mods
                    } else if let NoriskModSourceDefinition::Maven {
                        repository_ref,
                        group_id,
                        artifact_id,
                    } = &mod_entry.source
                    {
                        if let Some(target) = mod_entry
                            .compatibility
                            .get(minecraft_version)
                            .and_then(|l| l.get(loader_str))
                        {
                            // Disabled check is handled above
                            if let Some(canonical_key) =
                                get_canonical_key(&mod_entry.source, &mod_entry.id)
                            {
                                // Filename can be derived for Maven, or explicitly provided
                                match norisk_packs::get_norisk_pack_mod_filename(
                                    &mod_entry.source,
                                    target,
                                    &mod_entry.id,
                                ) {
                                    Ok(filename) => {
                                        let cache_path = mod_cache_dir.join(&filename);
                                        if cache_path.exists() {
                                            final_mods.insert(
                                                canonical_key.clone(),
                                                TargetMod {
                                                    mod_id: canonical_key,
                                                    filename: filename.clone(),
                                                    cache_path,
                                                },
                                            );
                                            info!(
                                                "Resolved Maven mod '{}' ('{}') from pack.",
                                                mod_entry
                                                    .display_name
                                                    .as_deref()
                                                    .unwrap_or(&mod_entry.id),
                                                filename
                                            );
                                        } else {
                                            warn!(
                                            "Maven mod '{}' defined in pack '{}' not found in cache at: {:?}. Skipping.",
                                            filename, pack_id, cache_path
                                        );
                                        }
                                    }
                                    Err(e) => {
                                        // Error during filename derivation/retrieval
                                        warn!(
                                        "Could not get/derive filename for pack Maven mod '{}' (ID: {}): {}. Skipping.",
                                        mod_entry.display_name.as_deref().unwrap_or(&mod_entry.id), mod_entry.id, e
                                    );
                                    }
                                } // End get_filename match
                            } // End get_canonical_key match
                        } // End compatibility check
                    } // End Modrinth/URL/Maven checks
                } // End for mod_entry
            }
            Err(e) => {
                warn!(
                    "Could not resolve Norisk Pack definition for pack ID '{}': {}. Skipping pack mods.",
                    pack_id, e
                );
            }
        }
    }

    // 2. Process Profile Mods (Only Modrinth for Overrides)
    info!(
        "Resolving manually added/overridden mods for profile: '{}'",
        profile.name
    );
    for mod_info in &profile.mods {
        if !mod_info.enabled {
            debug!(
                "Skipping disabled profile mod: {}",
                mod_info
                    .display_name
                    .as_deref()
                    .unwrap_or(&mod_info.id.to_string())
            );
            continue;
        }

        // --- Moved Compatibility Checks (Applied to *all* enabled profile mods) ---

        // 1. Game Version Check
        if let Some(mod_gv_list) = &mod_info.game_versions {
            if !mod_gv_list.is_empty() && !mod_gv_list.contains(&minecraft_version.to_string()) {
                debug!(
                    "Skipping profile mod '{}' (intended for MC {:?}) because target version is {}",
                    mod_info
                        .display_name
                        .as_deref()
                        .unwrap_or(&mod_info.id.to_string()),
                    mod_gv_list,
                    minecraft_version
                );
                continue; // Skip if target game version is not in the list
            }
        }

        // 2. Loader Check
        let profile_loader = profile.loader;
        match mod_info.associated_loader {
            Some(mod_loader) => {
                if mod_loader != profile_loader {
                    debug!(
                        "Skipping profile mod '{}' (intended for loader {:?}) because profile loader is {:?}",
                        mod_info.display_name.as_deref().unwrap_or(&mod_info.id.to_string()),
                        mod_loader,
                        profile_loader
                    );
                    continue; // Skip if loader doesn't match
                }
            }
            None => {
                debug!(
                    "Skipping profile mod '{}' because it lacks an associated loader.",
                    mod_info
                        .display_name
                        .as_deref()
                        .unwrap_or(&mod_info.id.to_string())
                );
                continue; // Skip if no loader is associated in profile mod
            }
        }
        // --- End Moved Compatibility Checks ---

        // Compatibility checks passed, now process based on source type
        match &mod_info.source {
            ModSource::Modrinth { .. } | ModSource::Url { .. } | ModSource::Maven { .. } => {
                // Common logic for sources that can override pack mods
                if let Some(canonical_key) = get_canonical_key_profile(&mod_info.source) {
                    match profile_state::get_profile_mod_filename(&mod_info.source) {
                        Ok(filename) => {
                            let cache_path = mod_cache_dir.join(&filename);
                            if cache_path.exists() {
                                let mod_type_str = match &mod_info.source {
                                    ModSource::Modrinth { .. } => "Modrinth",
                                    ModSource::Url { .. } => "URL",
                                    ModSource::Maven { .. } => "Maven",
                                    _ => "Unknown", // Should not happen here
                                };

                                if final_mods.contains_key(&canonical_key) {
                                    info!(
                                        "Overriding pack {} mod with key '{}' with profile version: {}",
                                        mod_type_str, canonical_key, filename
                                    );
                                } else {
                                    info!(
                                        "Adding profile {} mod to list: {}",
                                        mod_type_str, filename
                                    );
                                }
                                // Insert/Override using the canonical key
                                final_mods.insert(
                                    canonical_key.clone(),
                                    TargetMod {
                                        mod_id: canonical_key,
                                        filename,
                                        cache_path,
                                    },
                                );
                            } else {
                                warn!(
                                    "Profile defined mod '{}' not found in cache at: {:?}. Skipping.",
                                    filename, cache_path
                                );
                            }
                        }
                        Err(e) => {
                            // Error getting filename from profile mod source
                            warn!(
                                "Could not determine filename for profile mod '{}': {}. Skipping.",
                                mod_info
                                    .display_name
                                    .as_deref()
                                    .unwrap_or(&mod_info.id.to_string()),
                                e
                            );
                        }
                    }
                } else {
                    // Log if canonical key fails for expected types
                    warn!(
                        "Could not get canonical key for profile mod: {:?}",
                        mod_info.source
                    );
                }
            }
            ModSource::Local { .. } | ModSource::Embedded { .. } => {
                // Ignore Local/Embedded mods in the profile.mods list for resolution purposes.
                // These should be handled via custom_mods.
                debug!(
                    "Ignoring profile mod of type {:?} during resolution.",
                    mod_info.source.clone()
                );
            }
        }
    }

    // 3. Process Custom Mods (Add if enabled)
    info!(
        "Resolving custom (local) mods for profile: '{}'",
        profile.name
    );
    if let Some(custom_mods) = custom_mod_infos {
        let mut custom_mods_added = 0;
        for info in custom_mods {
            if info.is_enabled {
                // Create a unique key for the HashMap
                let canonical_key = format!("local:{}", info.filename);

                // Check if a mod with the same *filename* might already exist from pack/profile?
                // For now, let's allow custom mods to always be included alongside others,
                // even if filenames clash. The sync logic handles the final file state.
                // If override is desired, check final_mods.values().any(|tm| tm.filename == info.filename)

                let target = TargetMod {
                    mod_id: canonical_key.clone(),
                    filename: info.filename.clone(),
                    cache_path: info.path.clone(), // Use the direct path from custom_mods
                };

                // Use the unique canonical key
                if final_mods.insert(canonical_key.clone(), target).is_none() {
                    debug!(
                        "Adding enabled custom mod to target list: {}",
                        info.filename
                    );
                    custom_mods_added += 1;
                } else {
                    // This should not happen if canonical keys are unique, but log just in case
                    warn!("Custom mod canonical key collision: {}", canonical_key);
                }
            } else {
                debug!("Skipping disabled custom mod: {}", info.filename);
            }
        }
        info!(
            "Added {} enabled custom mods to the target list.",
            custom_mods_added
        );
    } else {
        info!("No custom mod information provided for resolving.");
    }

    let final_target_list: Vec<TargetMod> = final_mods.into_values().collect();
    info!(
        "Resolved {} total target mods for sync (incl. custom & overrides).",
        final_target_list.len()
    );
    debug!("Final target mods for sync: {:?}", final_target_list);
    Ok(final_target_list)
}
