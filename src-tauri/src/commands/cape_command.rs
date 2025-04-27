use crate::error::{AppError, CommandError};
use crate::minecraft::api::cape_api::{CapeApi, CapesBrowseResponse};
use crate::state::state_manager::State;
use log::{debug, error};
use std::path::PathBuf;
use uuid::Uuid;

/// Browse capes with optional parameters
///
/// Parameters:
/// - page: Page number (default: 0)
/// - page_size: Number of items per page (default: 20)
/// - sort_by: Sort order (newest, oldest, mostUsed)
/// - filter_has_elytra: Filter capes with elytra (true/false)
/// - filter_creator: Filter by creator UUID
/// - time_frame: Time frame filter (weekly, monthly)
/// - request_uuid: UUID for tracking the request
/// - norisk_token: Optional NoRisk token
#[tauri::command]
pub async fn browse_capes(
    page: Option<u32>,
    page_size: Option<u32>,
    sort_by: Option<String>,
    filter_has_elytra: Option<bool>,
    filter_creator: Option<String>,
    time_frame: Option<String>,
    norisk_token: Option<String>,
    request_uuid: Option<String>,
) -> Result<CapesBrowseResponse, CommandError> {
    debug!("Command called: browse_capes");
    debug!("Parameters: page={:?}, page_size={:?}, sort_by={:?}, filter_has_elytra={:?}, filter_creator={:?}, time_frame={:?}, norisk_token={:?}, request_uuid={:?}", 
        page, page_size, sort_by, filter_has_elytra, filter_creator, time_frame, norisk_token, request_uuid);

    // Get the state manager
    let state = State::get().await?;

    // Get the is_experimental value from the config state
    let is_experimental = state.config_manager.is_experimental_mode().await;
    debug!("Using experimental mode: {}", is_experimental);

    // Get the active account
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;

    // Get the NoRisk token: prioritize passed token, otherwise get from active account
    let token_to_use = match norisk_token {
        Some(token) => {
            debug!("Using provided NoRisk token.");
            token
        }
        None => {
            debug!("No token provided, retrieving from active account.");
            active_account
                .norisk_credentials
                .get_token_for_mode(is_experimental)?
        }
    };

    let cape_api = CapeApi::new();

    // Convert filter_creator from String to Uuid if provided
    let filter_creator_uuid = if let Some(creator_str) = filter_creator {
        match Uuid::parse_str(&creator_str) {
            Ok(uuid) => Some(uuid),
            Err(e) => {
                debug!("Invalid UUID format for filter_creator: {}", e);
                return Err(CommandError::from(AppError::InvalidInput(format!(
                    "Invalid UUID format for filter_creator: {}",
                    e
                ))));
            }
        }
    } else {
        None
    };

    // Determine the request UUID to use
    let uuid_to_use = match request_uuid {
        Some(uuid) => {
            debug!("Using provided request UUID: {}", uuid);
            uuid
        }
        None => {
            debug!("No request UUID provided, using active account ID: {}", active_account.id);
            active_account.id.to_string()
        }
    };

    let result = cape_api
        .browse_capes(
            &token_to_use,
            page,
            page_size,
            sort_by.as_deref(),
            filter_has_elytra,
            filter_creator_uuid.as_ref(),
            time_frame.as_deref(),
            &uuid_to_use,
            is_experimental,
        )
        .await
        .map_err(|e| {
            debug!("Failed to browse capes: {:?}", e);
            CommandError::from(e)
        });

    if result.is_ok() {
        debug!("Command completed: browse_capes");
    } else {
        debug!("Command failed: browse_capes");
    }

    result
}

/// Get capes for a specific player
///
/// Parameters:
/// - player_uuid: UUID of the player
/// - page: Page number (default: 0)
/// - page_size: Number of items per page (default: 20)
/// - filter_accepted: Filter by accepted status (default: true)
/// - request_uuid: UUID for tracking the request
/// - norisk_token: Optional NoRisk token
#[tauri::command]
pub async fn get_player_capes(
    player_uuid: String,
    page: Option<u32>,
    page_size: Option<u32>,
    filter_accepted: Option<bool>,
    norisk_token: Option<String>,
    request_uuid: Option<String>,
) -> Result<CapesBrowseResponse, CommandError> {
    debug!(
        "Command called: get_player_capes for player: {}",
        player_uuid
    );
    debug!(
        "Parameters: page={:?}, page_size={:?}, filter_accepted={:?}, norisk_token={:?}, request_uuid={:?}",
        page, page_size, filter_accepted, norisk_token, request_uuid
    );

    // Get the state manager
    let state = State::get().await?;

    // Get the is_experimental value from the config state
    let is_experimental = state.config_manager.is_experimental_mode().await;
    debug!("Using experimental mode: {}", is_experimental);

    // Get the active account
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;

    // Get the NoRisk token: prioritize passed token, otherwise get from active account
    let token_to_use = match norisk_token {
        Some(token) => {
            debug!("Using provided NoRisk token.");
            token
        }
        None => {
            debug!("No token provided, retrieving from active account.");
            active_account
                .norisk_credentials
                .get_token_for_mode(is_experimental)?
        }
    };

    let cape_api = CapeApi::new();

    // Convert player_uuid from String to Uuid
    let player_uuid = match Uuid::parse_str(&player_uuid) {
        Ok(uuid) => uuid,
        Err(e) => {
            debug!("Invalid UUID format for player_uuid: {}", e);
            return Err(CommandError::from(AppError::InvalidInput(format!(
                "Invalid UUID format for player_uuid: {}",
                e
            ))));
        }
    };

    // Determine the request UUID to use
    let uuid_to_use = match request_uuid {
        Some(uuid) => {
            debug!("Using provided request UUID: {}", uuid);
            uuid
        }
        None => {
            debug!("No request UUID provided, using active account ID: {}", active_account.id);
            active_account.id.to_string()
        }
    };

    let result = cape_api
        .get_player_capes(
            &token_to_use,
            &player_uuid,
            page,
            page_size,
            filter_accepted,
            &uuid_to_use,
            is_experimental,
        )
        .await
        .map_err(|e| {
            debug!("Failed to get player capes: {:?}", e);
            CommandError::from(e)
        });

    if result.is_ok() {
        debug!("Command completed: get_player_capes");
    } else {
        debug!("Command failed: get_player_capes");
    }

    result
}

/// Equip a specific cape for a player
///
/// Parameters:
/// - cape_hash: Hash of the cape to equip
/// - norisk_token: Optional NoRisk token
/// - player_uuid: Optional UUID of the player (defaults to active account)
#[tauri::command]
pub async fn equip_cape(
    cape_hash: String,
    norisk_token: Option<String>,
    player_uuid: Option<Uuid>, // Changed to Option<Uuid>
) -> Result<(), CommandError> {
    debug!("Command called: equip_cape for cape_hash: {}, player_uuid: {:?}", cape_hash, player_uuid);

    // Get the state manager
    let state = State::get().await?;

    // Get the is_experimental value from the config state
    let is_experimental = state.config_manager.is_experimental_mode().await;
    debug!("Using experimental mode: {}", is_experimental);

    // Get the active account
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;

    // Get the NoRisk token: prioritize passed token, otherwise get from active account
    let token_to_use = match norisk_token {
        Some(token) => {
            debug!("Using provided NoRisk token.");
            token
        }
        None => {
            debug!("No token provided, retrieving from active account.");
            active_account
                .norisk_credentials
                .get_token_for_mode(is_experimental)?
        }
    };

    let cape_api = CapeApi::new();

    // Determine the player UUID to use
    let uuid_to_use = match player_uuid {
        Some(uuid) => {
            debug!("Using provided player UUID: {}", uuid);
            uuid
        }
        None => {
            debug!("No player UUID provided, using active account ID: {}", active_account.id);
            active_account.id
        }
    };

    let result = cape_api
        .equip_cape(
            &token_to_use,
            &uuid_to_use, // Use the determined UUID
            &cape_hash,
            is_experimental,
        )
        .await
        .map_err(|e| {
            debug!("Failed to equip cape: {:?}", e);
            CommandError::from(e)
        });

    if result.is_ok() {
        debug!("Command completed: equip_cape");
    } else {
        debug!("Command failed: equip_cape");
    }

    result
}

/// Delete a specific cape owned by the player
///
/// Parameters:
/// - cape_hash: Hash of the cape to delete
/// - norisk_token: Optional NoRisk token
/// - player_uuid: Optional UUID of the player (defaults to active account)
#[tauri::command]
pub async fn delete_cape(
    cape_hash: String,
    norisk_token: Option<String>,
    player_uuid: Option<Uuid>, // Changed to Option<Uuid>
) -> Result<(), CommandError> {
    debug!("Command called: delete_cape for cape_hash: {}, player_uuid: {:?}", cape_hash, player_uuid);

    // Get the state manager
    let state = State::get().await?;

    // Get the is_experimental value from the config state
    let is_experimental = state.config_manager.is_experimental_mode().await;
    debug!("Using experimental mode: {}", is_experimental);

    // Get the active account
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;

    // Get the NoRisk token: prioritize passed token, otherwise get from active account
    let token_to_use = match norisk_token {
        Some(token) => {
            debug!("Using provided NoRisk token.");
            token
        }
        None => {
            debug!("No token provided, retrieving from active account.");
            active_account
                .norisk_credentials
                .get_token_for_mode(is_experimental)?
        }
    };

    let cape_api = CapeApi::new();

    // Determine the player UUID to use
    let uuid_to_use = match player_uuid {
        Some(uuid) => {
            debug!("Using provided player UUID: {}", uuid);
            uuid
        }
        None => {
            debug!("No player UUID provided, using active account ID: {}", active_account.id);
            active_account.id
        }
    };

    let result = cape_api
        .delete_cape(
            &token_to_use,
            &uuid_to_use, // Use the determined UUID
            &cape_hash,
            is_experimental,
        )
        .await
        .map_err(|e| {
            debug!("Failed to delete cape: {:?}", e);
            CommandError::from(e)
        });

    if result.is_ok() {
        debug!("Command completed: delete_cape");
    } else {
        debug!("Command failed: delete_cape");
    }

    result
}

/// Upload a new cape image for the active player
///
/// Parameters:
/// - image_path: Path to the cape image file (PNG)
/// - norisk_token: Optional NoRisk token
/// - player_uuid: Optional UUID of the player (defaults to active account)
#[tauri::command]
pub async fn upload_cape(
    image_path: String,
    norisk_token: Option<String>,
    player_uuid: Option<Uuid>, // Changed to Option<Uuid>
) -> Result<String, CommandError> {
    debug!("Command called: upload_cape with image_path: {}, player_uuid: {:?}", image_path, player_uuid);

    // Get the state manager
    let state = State::get().await?;

    // Get the is_experimental value from the config state
    let is_experimental = state.config_manager.is_experimental_mode().await;
    debug!("Using experimental mode: {}", is_experimental);

    // Get the active account
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;

    // Get the NoRisk token: prioritize passed token, otherwise get from active account
    let token_to_use = match norisk_token {
        Some(token) => {
            debug!("Using provided NoRisk token.");
            token
        }
        None => {
            debug!("No token provided, retrieving from active account.");
            active_account
                .norisk_credentials
                .get_token_for_mode(is_experimental)?
        }
    };

    let cape_api = CapeApi::new();

    // Determine the player UUID to use
    let uuid_to_use = match player_uuid {
        Some(uuid) => {
            debug!("Using provided player UUID: {}", uuid);
            uuid
        }
        None => {
            debug!("No player UUID provided, using active account ID: {}", active_account.id);
            active_account.id
        }
    };

    // Convert image_path string to PathBuf
    let image_path_buf = PathBuf::from(image_path);

    let result = cape_api
        .upload_cape(
            &token_to_use,
            &uuid_to_use, // Use the determined UUID
            &image_path_buf,
            is_experimental,
        )
        .await
        .map_err(|e| {
            debug!("Failed to upload cape: {:?}", e);
            CommandError::from(e)
        });

    if result.is_ok() {
        debug!("Command completed: upload_cape");
    } else {
        debug!("Command failed: upload_cape");
    }

    result
}

/// Unequip the currently equipped cape for the active player
///
/// Parameters:
/// - norisk_token: Optional NoRisk token
/// - player_uuid: Optional UUID of the player (defaults to active account)
#[tauri::command]
pub async fn unequip_cape(
    norisk_token: Option<String>,
    player_uuid: Option<Uuid>, // Changed to Option<Uuid>
) -> Result<(), CommandError> {
    debug!("Command called: unequip_cape for player_uuid: {:?}", player_uuid);

    // Get the state manager
    let state = State::get().await?;

    // Get the is_experimental value from the config state
    let is_experimental = state.config_manager.is_experimental_mode().await;
    debug!("Using experimental mode: {}", is_experimental);

    // Get the active account
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;

    // Get the NoRisk token: prioritize passed token, otherwise get from active account
    let token_to_use = match norisk_token {
        Some(token) => {
            debug!("Using provided NoRisk token.");
            token
        }
        None => {
            debug!("No token provided, retrieving from active account.");
            active_account
                .norisk_credentials
                .get_token_for_mode(is_experimental)?
        }
    };

    let cape_api = CapeApi::new();

    // Determine the player UUID to use
    let uuid_to_use = match player_uuid {
        Some(uuid) => {
            debug!("Using provided player UUID: {}", uuid);
            uuid
        }
        None => {
            debug!("No player UUID provided, using active account ID: {}", active_account.id);
            active_account.id
        }
    };

    let result = cape_api
        .unequip_cape(
            &token_to_use,
            &uuid_to_use, // Use the determined UUID
            is_experimental,
        )
        .await
        .map_err(|e| {
            debug!("Failed to unequip cape: {:?}", e);
            CommandError::from(e)
        });

    if result.is_ok() {
        debug!("Command completed: unequip_cape");
    } else {
        debug!("Command failed: unequip_cape");
    }

    result
}
