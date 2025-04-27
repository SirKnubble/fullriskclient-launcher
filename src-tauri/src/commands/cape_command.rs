use crate::error::{AppError, CommandError};
use crate::minecraft::api::cape_api::{CapeApi, CapesBrowseResponse};
use crate::state::state_manager::State;
use log::{debug, error};
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
#[tauri::command]
pub async fn browse_capes(
    page: Option<u32>,
    page_size: Option<u32>,
    sort_by: Option<String>,
    filter_has_elytra: Option<bool>,
    filter_creator: Option<String>,
    time_frame: Option<String>,
) -> Result<CapesBrowseResponse, CommandError> {
    debug!("Command called: browse_capes");
    debug!("Parameters: page={:?}, page_size={:?}, sort_by={:?}, filter_has_elytra={:?}, filter_creator={:?}, time_frame={:?}", 
        page, page_size, sort_by, filter_has_elytra, filter_creator, time_frame);

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

    // Get the NoRisk token using the new helper method
    let norisk_token = active_account
        .norisk_credentials
        .get_token_for_mode(is_experimental)?;

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

    let result = cape_api
        .browse_capes(
            &norisk_token,
            page,
            page_size,
            sort_by.as_deref(),
            filter_has_elytra,
            filter_creator_uuid.as_ref(),
            time_frame.as_deref(),
            &active_account.id.to_string(),
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
#[tauri::command]
pub async fn get_player_capes(
    player_uuid: String,
    page: Option<u32>,
    page_size: Option<u32>,
    filter_accepted: Option<bool>,
) -> Result<CapesBrowseResponse, CommandError> {
    debug!(
        "Command called: get_player_capes for player: {}",
        player_uuid
    );
    debug!(
        "Parameters: page={:?}, page_size={:?}, filter_accepted={:?}",
        page, page_size, filter_accepted
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

    // Get the NoRisk token using the new helper method
    let norisk_token = active_account
        .norisk_credentials
        .get_token_for_mode(is_experimental)?;

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

    let result = cape_api
        .get_player_capes(
            &norisk_token,
            &player_uuid,
            page,
            page_size,
            filter_accepted,
            &active_account.id.to_string(),
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
/// - player_uuid: UUID of the player
/// - cape_hash: Hash of the cape to equip
#[tauri::command]
pub async fn equip_cape(cape_hash: String) -> Result<(), CommandError> {
    debug!("Command called: equip_cape for cape_hash: {}", cape_hash);

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

    // Get the NoRisk token using the new helper method
    let norisk_token = active_account
        .norisk_credentials
        .get_token_for_mode(is_experimental)?;

    let cape_api = CapeApi::new();

    let result = cape_api
        .equip_cape(
            &norisk_token,
            &active_account.id,
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
