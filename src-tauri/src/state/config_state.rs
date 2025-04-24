use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::Result;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::{Mutex, RwLock};

const CONFIG_FILENAME: &str = "launcher_config.json";
const CONFIG_CURRENT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherConfig {
    #[serde(default = "default_config_version")]
    pub version: u32,
    #[serde(default)]
    pub is_experimental: bool,
    // Add more configuration options as needed:
    #[serde(default)]
    pub auto_check_updates: bool,
    #[serde(default = "default_concurrent_downloads")]
    pub concurrent_downloads: usize,
}

fn default_config_version() -> u32 {
    CONFIG_CURRENT_VERSION
}

fn default_concurrent_downloads() -> usize {
    3
}

impl Default for LauncherConfig {
    fn default() -> Self {
        Self {
            version: CONFIG_CURRENT_VERSION,
            is_experimental: false,
            auto_check_updates: true,
            concurrent_downloads: default_concurrent_downloads(),
        }
    }
}

pub struct ConfigManager {
    config: Arc<RwLock<LauncherConfig>>,
    config_path: PathBuf,
    save_lock: Mutex<()>,
}

impl ConfigManager {
    pub async fn new() -> Result<Self> {
        let config_path = LAUNCHER_DIRECTORY.root_dir().join(CONFIG_FILENAME);
        info!("Initializing ConfigManager with path: {:?}", config_path);
        
        let manager = Self {
            config: Arc::new(RwLock::new(LauncherConfig::default())),
            config_path,
            save_lock: Mutex::new(()),
        };
        
        // Load config if it exists
        manager.load_config().await?;
        
        Ok(manager)
    }
    
    async fn load_config(&self) -> Result<()> {
        if !self.config_path.exists() {
            info!("Config file not found, using default configuration");
            // Save the default config
            self.save_config().await?;
            return Ok(());
        }
        
        info!("Loading launcher configuration from: {:?}", self.config_path);
        let config_data = fs::read_to_string(&self.config_path).await?;
        
        match serde_json::from_str::<LauncherConfig>(&config_data) {
            Ok(loaded_config) => {
                info!("Successfully loaded launcher configuration");
                debug!("Loaded config: {:?}", loaded_config);
                
                // Update the stored config
                let mut config = self.config.write().await;
                *config = loaded_config;
            },
            Err(e) => {
                error!("Failed to parse config file: {}", e);
                warn!("Using default configuration and saving it");
                // Save the default config to repair the file
                self.save_config().await?;
            }
        }
        
        Ok(())
    }
    
    async fn save_config(&self) -> Result<()> {
        let _guard = self.save_lock.lock().await;
        debug!("Acquired save lock, proceeding to save config...");
        
        // Ensure directory exists
        if let Some(parent_dir) = self.config_path.parent() {
            if !parent_dir.exists() {
                fs::create_dir_all(parent_dir).await?;
                info!("Created directory for config file: {:?}", parent_dir);
            }
        }
        
        let config = self.config.read().await;
        let config_data = serde_json::to_string_pretty(&*config)?;
        
        fs::write(&self.config_path, config_data).await?;
        info!("Successfully saved launcher configuration to: {:?}", self.config_path);
        
        Ok(())
    }
    
    // Public methods for accessing and modifying configuration
    
    pub async fn get_config(&self) -> LauncherConfig {
        self.config.read().await.clone()
    }
    
    pub async fn set_experimental_mode(&self, is_experimental: bool) -> Result<()> {
        {
            let mut config = self.config.write().await;
            if config.is_experimental == is_experimental {
                debug!("Experimental mode already set to {}, no change needed", is_experimental);
                return Ok(());
            }
            
            info!("Setting experimental mode to: {}", is_experimental);
            config.is_experimental = is_experimental;
        }
        
        // Save the updated config
        self.save_config().await
    }
    
    pub async fn is_experimental_mode(&self) -> bool {
        self.config.read().await.is_experimental
    }
    
    pub async fn set_auto_check_updates(&self, auto_check: bool) -> Result<()> {
        {
            let mut config = self.config.write().await;
            if config.auto_check_updates == auto_check {
                return Ok(());
            }
            
            info!("Setting auto check updates to: {}", auto_check);
            config.auto_check_updates = auto_check;
        }
        
        // Save the updated config
        self.save_config().await
    }
    
    pub async fn set_concurrent_downloads(&self, count: usize) -> Result<()> {
        {
            let mut config = self.config.write().await;
            if config.concurrent_downloads == count {
                return Ok(());
            }
            
            info!("Setting concurrent downloads to: {}", count);
            config.concurrent_downloads = count;
        }
        
        // Save the updated config
        self.save_config().await
    }
}

pub fn default_config_path() -> PathBuf {
    LAUNCHER_DIRECTORY.root_dir().join(CONFIG_FILENAME)
} 