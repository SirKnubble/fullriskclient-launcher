use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::error::Result;
use crate::integrations::norisk_versions::NoriskVersionsConfig;
use log::{info, error};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use tokio::sync::Mutex;

// Default filename for the Norisk versions configuration
const NORISK_VERSIONS_FILENAME: &str = "norisk_versions.json";

pub struct NoriskVersionManager {
    config: Arc<RwLock<NoriskVersionsConfig>>,
    config_path: PathBuf,
    save_lock: Mutex<()>, // Lock for potential future save operations
}

impl NoriskVersionManager {
    /// Creates a new NoriskVersionManager instance, loading the configuration from the specified path.
    /// If the file doesn't exist, it initializes with a default empty configuration.
    pub async fn new(config_path: PathBuf) -> Result<Self> {
        info!("Initializing NoriskVersionManager with path: {:?}", config_path);
        // Load initial config. If loading fails critically (e.g., IO error other than NotFound),
        // propagate the error. If parsing fails or file not found, use default.
        let config = Self::load_config(&config_path).await.unwrap_or_else(|e| {
            error!("Critical error loading norisk_versions.json (path: {:?}): {}. Using default empty config.", config_path, e);
            NoriskVersionsConfig { profiles: vec![] }
        });
        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            config_path,
            save_lock: Mutex::new(()),
        })
    }

    /// Loads the Norisk versions configuration from a JSON file.
    /// Returns a default empty config if the file doesn't exist or cannot be parsed.
    async fn load_config(path: &PathBuf) -> Result<NoriskVersionsConfig> {
        if !path.exists() {
            info!("Norisk versions config file not found at {:?}, using default empty config.", path);
            return Ok(NoriskVersionsConfig { profiles: vec![] });
        }

        let data = fs::read_to_string(path).await?;

        match serde_json::from_str(&data) {
            Ok(config) => Ok(config),
            Err(e) => {
                error!("Failed to parse norisk_versions.json at {:?}: {}. Returning default empty config.", path, e);
                // Return default instead of error to allow launcher to start even with broken config
                Ok(NoriskVersionsConfig { profiles: vec![] })
            }
        }
    }

    /// Saves the current configuration back to the JSON file.
    /// Note: This might not be frequently used for standard versions unless caching fetched data.
    #[allow(dead_code)]
    async fn save_config(&self) -> Result<()> {
        let _guard = self.save_lock.lock().await;

        let config_data = {
            let config_guard = self.config.read().await;
            serde_json::to_string_pretty(&*config_guard)?
        };
        
        if let Some(parent_dir) = self.config_path.parent() {
             if !parent_dir.exists() {
                fs::create_dir_all(parent_dir).await?;
                info!("Created directory for norisk versions config: {:?}", parent_dir);
            }
        }

        fs::write(&self.config_path, config_data).await?;
        info!("Successfully saved norisk versions config to {:?}", self.config_path);
        Ok(())
    }

    /// Returns a clone of the entire current NoriskVersionsConfig.
    pub async fn get_config(&self) -> NoriskVersionsConfig {
        self.config.read().await.clone()
    }

     /// Updates the entire configuration and saves it to the file.
     /// Note: Use with caution, as standard versions are often meant to be static or fetched.
     #[allow(dead_code)]
     pub async fn update_config(&self, new_config: NoriskVersionsConfig) -> Result<()> {
         {
             let mut config_guard = self.config.write().await;
             *config_guard = new_config;
         } 
         self.save_config().await // Save the updated config
     }

    /// Prints the current configuration to the console for debugging.
    #[allow(dead_code)]
    pub async fn print_current_config(&self) {
        let config_guard = self.config.read().await;
        println!("--- Current Norisk Versions Config ---");
        println!("{:#?}", *config_guard);
        println!("--- End Norisk Versions Config ---");
    }

    // Add more specific accessor methods if needed, e.g.:
    // pub async fn get_standard_profile(&self, profile_id: Uuid) -> Option<NoriskVersionProfile> { ... }
}

/// Returns the default path for the norisk_versions.json file within the launcher directory.
pub fn default_norisk_versions_path() -> PathBuf {
    LAUNCHER_DIRECTORY.root_dir().join(NORISK_VERSIONS_FILENAME)
} 