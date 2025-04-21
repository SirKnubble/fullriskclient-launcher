use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    /// List of mods included in this specific pack variant.
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