use crate::error::{AppError, Result};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use log::{debug, error, info, warn};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};
use tokio::task;
use tokio::time::{sleep, Duration};

// Discord application ID for NoRiskClient
const DISCORD_APP_ID: &str = "775352010345021450"; // Replace with actual Discord application ID

// Different states for Discord Rich Presence
#[derive(Debug, Clone, PartialEq)]
pub enum DiscordState {
    Idle,
    BrowsingProfiles,
    LaunchingMinecraft(String), // Profile name
    PlayingMinecraft(String),   // Profile name
    ChangingSkins,
    ManagingMods,
}

pub struct DiscordManager {
    client: Arc<Mutex<Option<DiscordIpcClient>>>,
    current_state: Arc<RwLock<DiscordState>>,
    enabled: Arc<RwLock<bool>>,
}

impl DiscordManager {
    pub async fn new(enabled: bool) -> Result<Self> {
        info!("Initializing Discord Rich Presence Manager (enabled: {})", enabled);
        
        let manager = Self {
            client: Arc::new(Mutex::new(None)),
            current_state: Arc::new(RwLock::new(DiscordState::Idle)),
            enabled: Arc::new(RwLock::new(enabled)),
        };
        
        // Initialize Discord presence if enabled
        if enabled {
            debug!("Discord Rich Presence initially enabled, connecting...");
            // Errors während der Initialisierung werden ignoriert, aber geloggt
            if let Err(e) = manager.connect().await {
                error!("Failed to connect to Discord during initialization: {}", e);
                // Trotzdem fortsetzen, kein Return mit Fehler
            }

            // Force initial Discord state update
            debug!("Setting initial Discord state to Idle");
            // Force-Parameter auf true setzen, um den State auch zu setzen, wenn er schon Idle ist
            if let Err(e) = manager.set_state_internal(DiscordState::Idle, true).await {
                error!("Failed to set initial Discord state: {}", e);
                // Trotzdem fortsetzen, kein Return mit Fehler
            }
        } else {
            info!("Discord Rich Presence is disabled");
        }
        
        Ok(manager)
    }
    
    async fn connect(&self) -> Result<()> {
        if !*self.enabled.read().await {
            debug!("Discord Rich Presence is disabled, skipping connection");
            return Ok(());
        }
        
        debug!("Attempting to connect to Discord...");
        let mut client_lock = self.client.lock().await;
        
        // Only initialize if not already initialized
        if client_lock.is_none() {
            debug!("No existing Discord client, creating new one...");
            match DiscordIpcClient::new(DISCORD_APP_ID).map_err(|e| AppError::DiscordError(format!("Discord error: {}", e))) {
                Ok(mut client) => {
                    debug!("Discord client created, connecting...");
                    match client.connect().map_err(|e| AppError::DiscordError(format!("Discord connection error: {}", e))) {
                        Ok(_) => {
                            info!("Successfully connected to Discord client");
                            *client_lock = Some(client);
                        },
                        Err(e) => {
                            warn!("Failed to connect to Discord client: {}", e);
                            return Err(e);
                        }
                    }
                },
                Err(e) => {
                    warn!("Failed to create Discord client: {}", e);
                    return Err(e);
                }
            }
        } else {
            debug!("Discord client already exists");
        }
        
        Ok(())
    }
    
    async fn disconnect(&self) -> Result<()> {
        debug!("Attempting to disconnect from Discord...");
        let mut client_lock = self.client.lock().await;
        
        if let Some(mut client) = client_lock.take() {
            debug!("Found active Discord client, closing connection...");
            match client.close().map_err(|e| AppError::DiscordError(format!("Discord disconnect error: {}", e))) {
                Ok(_) => {
                    info!("Successfully disconnected from Discord client");
                }
                Err(e) => {
                    warn!("Error disconnecting from Discord client: {}", e);
                    return Err(e);
                }
            }
        } else {
            debug!("No active Discord client to disconnect");
        }
        
        Ok(())
    }
    
    // Public method that catches errors to prevent application crashes
    pub async fn set_state(&self, state: DiscordState) -> Result<()> {
        debug!("Setting Discord state to: {:?}", state);
        match self.set_state_internal(state, false).await {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("Error setting Discord state: {}. Continuing without Discord presence.", e);
                // Return Ok to prevent application errors
                Ok(())
            }
        }
    }
    
    // Internal implementation that can be forced to update
    async fn set_state_internal(&self, state: DiscordState, force: bool) -> Result<()> {
        // Check if Discord is enabled
        if !*self.enabled.read().await {
            debug!("Discord Rich Presence is disabled, ignoring state update");
            return Ok(());
        }
        
        {
            let mut current_state = self.current_state.write().await;
            
            // Only update if state changed or forced
            if !force && *current_state == state {
                debug!("Discord state unchanged, skipping update");
                return Ok(());
            }
            
            debug!("Updating Discord state from {:?} to {:?}", *current_state, state);
            *current_state = state.clone();
        }
        
        // Lock the client and set the activity
        let mut client_lock = self.client.lock().await;
        
        // If client is None, try to reconnect
        if client_lock.is_none() {
            debug!("No Discord client available, attempting to reconnect...");
            drop(client_lock); // Release the lock before reconnecting
            self.connect().await?;
            client_lock = self.client.lock().await;
        }
        
        if let Some(client_ref) = client_lock.as_mut() {
            // Create activity for current state
            let activity = self.create_activity_for_state(&state);
            
            debug!("Sending activity to Discord...");
            match client_ref.set_activity(activity).map_err(|e| AppError::DiscordError(format!("Discord activity error: {}", e))) {
                Ok(_) => {
                    debug!("Successfully updated Discord Rich Presence");
                },
                Err(e) => {
                    warn!("Failed to update Discord Rich Presence: {}", e);
                    // Try to reconnect
                    debug!("Attempting to reconnect to Discord...");
                    if let Err(reconnect_e) = client_ref.reconnect().map_err(|e| AppError::DiscordError(format!("Discord reconnect error: {}", e))) {
                        error!("Failed to reconnect to Discord: {}", reconnect_e);
                        return Err(reconnect_e);
                    }
                    
                    debug!("Reconnection successful, trying to set activity again...");
                    // Try setting activity again after reconnect with a new activity
                    let new_activity = self.create_activity_for_state(&state);
                    if let Err(retry_e) = client_ref.set_activity(new_activity).map_err(|e| AppError::DiscordError(format!("Discord activity error after reconnect: {}", e))) {
                        error!("Failed to update Discord Rich Presence after reconnect: {}", retry_e);
                        return Err(retry_e);
                    }
                    debug!("Successfully updated Discord Rich Presence after reconnect");
                }
            }
        } else {
            warn!("Failed to get Discord client, cannot set activity");
        }
        
        Ok(())
    }
    
    fn create_activity_for_state(&self, state: &DiscordState) -> activity::Activity {
        let start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        
        debug!("Creating activity for Discord state: {:?}", state);
        match state {
            DiscordState::Idle => {
                activity::Activity::new()
                    .state("Idle")
                    .details("In the launcher")
                    .assets(
                        activity::Assets::new()
                            .large_image("norisk_logo")
                            .large_text("NoRiskClient")
                    )
                    .timestamps(activity::Timestamps::new().start(start_time))
            },
            DiscordState::BrowsingProfiles => {
                activity::Activity::new()
                    .state("Browsing Profiles")
                    .details("Setting up Minecraft")
                    .assets(
                        activity::Assets::new()
                            .large_image("norisk_logo")
                            .large_text("NoRiskClient")
                    )
                    .timestamps(activity::Timestamps::new().start(start_time))
            },
            DiscordState::LaunchingMinecraft(profile) => {
                // Create a 'static string by leaking memory (intentionally)
                // This is safe because Discord RPC strings need to live for the duration of the Discord connection
                let profile_details = Box::leak(format!("Profile: {}", profile).into_boxed_str());
                
                activity::Activity::new()
                    .state("Launching Minecraft")
                    .details(profile_details)
                    .assets(
                        activity::Assets::new()
                            .large_image("norisk_logo")
                            .large_text("NoRiskClient")
                    )
                    .timestamps(activity::Timestamps::new().start(start_time))
            },
            DiscordState::PlayingMinecraft(profile) => {
                // Create a 'static string by leaking memory (intentionally)
                // This is safe because Discord RPC strings need to live for the duration of the Discord connection
                let profile_details = Box::leak(format!("Profile: {}", profile).into_boxed_str());
                
                activity::Activity::new()
                    .state("Playing Minecraft")
                    .details(profile_details)
                    .assets(
                        activity::Assets::new()
                            .large_image("norisk_logo")
                            .large_text("NoRiskClient")
                    )
                    .timestamps(activity::Timestamps::new().start(start_time))
            },
            DiscordState::ChangingSkins => {
                activity::Activity::new()
                    .state("Changing Skins")
                    .details("Customizing appearance")
                    .assets(
                        activity::Assets::new()
                            .large_image("norisk_logo")
                            .large_text("NoRiskClient")
                    )
                    .timestamps(activity::Timestamps::new().start(start_time))
            },
            DiscordState::ManagingMods => {
                activity::Activity::new()
                    .state("Managing Mods")
                    .details("Customizing gameplay")
                    .assets(
                        activity::Assets::new()
                            .large_image("norisk_logo")
                            .large_text("NoRiskClient")
                    )
                    .timestamps(activity::Timestamps::new().start(start_time))
            },
        }
    }
    
    // Set enable/disable state
    pub async fn set_enabled(&self, enabled: bool) -> Result<()> {
        debug!("Setting Discord Rich Presence enabled: {}", enabled);
        let mut enabled_lock = self.enabled.write().await;
        let was_enabled = *enabled_lock;
        *enabled_lock = enabled;
        
        if !was_enabled && enabled {
            // Was disabled, now enabled - connect
            debug!("Discord was disabled, now enabled - connecting...");
            drop(enabled_lock);
            
            // Catch errors to prevent application crashes
            if let Err(e) = self.connect().await {
                error!("Failed to connect to Discord when enabling: {}", e);
                // Continue without error return
                return Ok(());
            }
            
            // Set initial state and catch errors
            if let Err(e) = self.set_state_internal(DiscordState::Idle, true).await {
                error!("Failed to set initial Discord state: {}", e);
                // Continue without error return
                return Ok(());
            }
        } else if was_enabled && !enabled {
            // Was enabled, now disabled - disconnect
            debug!("Discord was enabled, now disabled - disconnecting...");
            drop(enabled_lock);
            
            // Catch errors to prevent application crashes
            if let Err(e) = self.disconnect().await {
                error!("Failed to disconnect from Discord when disabling: {}", e);
                // Continue without error return
            }
        } else {
            debug!("Discord enabled state unchanged: {}", enabled);
        }
        
        Ok(())
    }
    
    pub async fn get_current_state(&self) -> DiscordState {
        let state = self.current_state.read().await.clone();
        debug!("Getting current Discord state: {:?}", state);
        state
    }
    
    pub async fn is_enabled(&self) -> bool {
        let enabled = *self.enabled.read().await;
        debug!("Checking if Discord is enabled: {}", enabled);
        enabled
    }
} 