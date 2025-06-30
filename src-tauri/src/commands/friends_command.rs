use crate::error::{AppError, CommandError};
use crate::minecraft::api::friends_api::{
    FriendsApi, FriendsFriendRequestResponse, FriendsFriendsInformationConverted, FriendsUser,
    FriendsUserOnlineState,
};
use crate::state::state_manager::State;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewWindow};
use tokio::sync::Mutex;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

static WEBSOCKET_LOCK: Mutex<bool> = Mutex::const_new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub channel: String,
    pub data: serde_json::Value,
}

pub async fn start_friends_websocket_auto(window: &WebviewWindow) {
    let window_clone = window.clone();
    tokio::spawn(async move {
        let _ = start_friends_websocket_internal(&window_clone).await;
    });
}

async fn start_friends_websocket_internal(window: &WebviewWindow) -> Result<(), AppError> {
    let mut lock = WEBSOCKET_LOCK.lock().await;
    if *lock {
        return Ok(());
    }
    *lock = true;
    drop(lock);

    let state = State::get()
        .await
        .map_err(|e| AppError::Other(format!("Failed to get state: {}", e)))?;
    
    let active_account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await
        .map_err(|e| AppError::Other(format!("Failed to get active account for token refresh: {:?}", e)))?;
    
    if active_account.is_none() {
        return Err(AppError::NoCredentialsError);
    }
    
    let (token, user_uuid) = get_token_and_uuid_from_state(&state)
        .await
        .map_err(|e| AppError::Other(format!("Failed to get auth token: {:?}", e)))?;
    
    if token.trim().is_empty() {
        return Err(AppError::Other("Authentication token is empty".to_string()));
    }
    
    if token.len() < 10 {
        return Err(AppError::Other("Authentication token appears invalid".to_string()));
    }
    let username = get_username_from_state(&state)
        .await
        .map_err(|e| AppError::Other(format!("Failed to get username: {:?}", e)))?;

    let is_experimental = state.config_manager.is_experimental_mode().await;
    let ws_url = if is_experimental {
        format!(
            "wss://api-staging.norisk.gg/api/v1/core/ws?uuid={}&ign={}",
            user_uuid, username
        )
    } else {
        format!(
            "wss://api.norisk.gg/api/v1/core/ws?uuid={}&ign={}",
            user_uuid, username
        )
    };

    start_websocket_with_reconnect(&ws_url, &token, &window, user_uuid).await;

    let mut lock = WEBSOCKET_LOCK.lock().await;
    *lock = false;

    Ok(())
}

async fn start_websocket_with_reconnect(
    ws_url: &str,
    token: &str,
    window: &WebviewWindow,
    user_uuid: Uuid,
) {
    let mut retry_delay = Duration::from_secs(5);
    const MAX_RETRY_DELAY: Duration = Duration::from_secs(60);
    const MAX_CONSECUTIVE_FAILURES: u32 = 10;
    let mut consecutive_failures = 0;

    loop {
        match connect_to_websocket_single_attempt(ws_url, token, window, user_uuid).await {
            Ok(_) => {
                consecutive_failures = 0;
                retry_delay = Duration::from_secs(5);
            }
            Err(_) => {
                consecutive_failures += 1;
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES {
                    let _ = window.emit("friends-ws-error", "Max connection attempts reached");
                    break;
                }
            }
        }
        sleep(retry_delay).await;
        retry_delay = std::cmp::min(retry_delay * 2, MAX_RETRY_DELAY);
    }
}

async fn connect_to_websocket_single_attempt(
    ws_url: &str,
    token: &str,
    window: &WebviewWindow,
    _user_uuid: Uuid,
) -> Result<(), AppError> {
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use tokio_tungstenite::tungstenite::http::HeaderValue;

    let mut request = ws_url
        .into_client_request()
        .map_err(|e| AppError::Other(format!("Failed to create WebSocket request: {}", e)))?;
    let headers = request.headers_mut();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", token))
            .map_err(|e| AppError::Other(format!("Failed to parse Authorization header: {}", e)))?,
    );
    
    let (ws_stream, _response) = connect_async(request)
        .await
        .map_err(|e| AppError::Other(format!("Failed to connect to WebSocket: {}", e)))?;
    
    let _ = window.emit("friends-ws-connected", ());
    let (mut _ws_sender, mut ws_receiver) = ws_stream.split();

    while let Some(message) = ws_receiver.next().await {
        match message {
            Ok(Message::Text(text)) => {
                let _ = handle_websocket_message(&text, window).await;
            }
            Ok(Message::Close(_)) => {
                break;
            }
            Ok(Message::Ping(_)) => {}
            Ok(Message::Pong(_)) => {}
            Ok(Message::Binary(_)) => {}
            Ok(Message::Frame(_)) => {}
            Err(_) => {
                break;
            }
        }
    }

    let _ = window.emit("friends-ws-disconnected", ());
    Ok(())
}

async fn handle_websocket_message(text: &str, window: &WebviewWindow) -> Result<(), AppError> {
    let parts: Vec<&str> = text.splitn(3, ' ').collect();
    if parts.len() != 3 {
        return Err(AppError::Other("Invalid message format".to_string()));
    }

    let channel = parts[0];
    let _timestamp = parts[1];
    let json_data = parts[2];
    
    let data: serde_json::Value = serde_json::from_str(json_data)
        .map_err(|e| AppError::Other(format!("Failed to parse JSON: {}", e)))?;

    let envelope = Envelope {
        channel: channel.to_string(),
        data: data.clone(),
    };

    if let Ok(state) = State::get().await {
        match envelope.channel.as_str() {
            "nrc_friends:friend_online"
            | "nrc_friends:friend_offline"
            | "nrc_friends:friend_request"
            | "nrc_friends:friend_update"
            | "nrc_friends:friend_changed_online_state"
            | "nrc_friends:server_change" => {
                let _ = refresh_friends_cache(&state).await;
            }
            "messaging:message_received"
            | "messaging:message_updated"
            | "messaging:message_deleted"
            | "messaging:chat_created"
            | "messaging:user_typing"
            | "messaging:user_start_typing"
            | "messaging:user_stop_typing" => {
                let _ = refresh_messaging_cache(&state).await;
            }
            _ => {}
        }
    }

    let _ = window.emit("friends-ws-message", &envelope);

    let app_handle = window.app_handle();
    
    if let Some(friends_window) = app_handle.get_webview_window("friends") {
        let _ = friends_window.emit("global-messaging-event", &envelope);
    }
    
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("global-messaging-event", &envelope);
    }
    
    Ok(())
}

pub async fn get_token_and_uuid_from_state(state: &State) -> Result<(String, Uuid), CommandError> {
    let credentials = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;
    
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let token_result = credentials
        .norisk_credentials
        .get_token_for_mode(is_experimental);
    
    let token = match token_result {
        Ok(token) => token,
        Err(_e) => {
            let refreshed_credentials = state
                .minecraft_account_manager_v2
                .update_norisk_and_microsoft_token(&credentials, is_experimental)
                .await
                .map_err(|refresh_err| CommandError::from(AppError::Other(format!(
                    "Failed to refresh NoRisk token for {} mode: {}",
                    if is_experimental { "experimental" } else { "production" },
                    refresh_err
                ))))?
                .ok_or_else(|| CommandError::from(AppError::Other(
                    "Token refresh succeeded but returned no credentials".to_string()
                )))?;
            
            refreshed_credentials
                .norisk_credentials
                .get_token_for_mode(is_experimental)
                .map_err(|e| CommandError::from(AppError::Other(format!(
                    "Failed to get NoRisk token for {} mode even after refresh: {}",
                    if is_experimental { "experimental" } else { "production" },
                    e
                ))))?
        }
    };
    
    let user_uuid = credentials.id;
    Ok((token, user_uuid))
}

pub async fn get_username_from_state(state: &State) -> Result<String, CommandError> {
    let credentials = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;
    Ok(credentials.username)
}

#[tauri::command]
pub async fn get_auth_token_command() -> Result<String, CommandError> {
    let state = State::get().await?;
    let (token, _) = get_token_and_uuid_from_state(&state).await?;
    Ok(token)
}

#[tauri::command]
pub async fn get_friends_information_command(
) -> Result<FriendsFriendsInformationConverted, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friends_info =
        FriendsApi::get_friends_information(is_experimental, &token, user_uuid, user_uuid).await?;

    let converted_info = friends_info.into_converted();
    Ok(converted_info)
}

#[tauri::command]
pub async fn get_user_command() -> Result<FriendsUser, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let user = FriendsApi::get_own_user(is_experimental, &token, user_uuid).await?;
    Ok(user)
}

#[tauri::command]
pub async fn remove_friend_command(
    target_uuid: String,
) -> Result<FriendsFriendRequestResponse, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friend_uuid = Uuid::parse_str(&target_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid UUID: {}", e))))?;
    let result = FriendsApi::remove_friend(is_experimental, &token, friend_uuid, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn accept_friend_request_command(
    sender_uuid: String,
) -> Result<FriendsFriendRequestResponse, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friend_uuid = Uuid::parse_str(&sender_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid UUID: {}", e))))?;
    let result =
        FriendsApi::accept_friend_request(is_experimental, &token, friend_uuid, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn decline_friend_request_command(
    sender_uuid: String,
) -> Result<FriendsFriendRequestResponse, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friend_uuid = Uuid::parse_str(&sender_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid UUID: {}", e))))?;
    let result = FriendsApi::remove_friend(is_experimental, &token, friend_uuid, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn toggle_afk_command(now_afk: bool) -> Result<FriendsUserOnlineState, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let result = FriendsApi::toggle_afk(is_experimental, &token, now_afk, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn set_server_command(server: String) -> Result<FriendsUser, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let result = FriendsApi::set_server(is_experimental, &token, &server, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn remove_server_command() -> Result<FriendsUser, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let result = FriendsApi::remove_server(is_experimental, &token, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn invite_to_server_command(
    friend_uuid: String,
    domain: String,
) -> Result<(), CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friend_uuid = Uuid::parse_str(&friend_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid UUID: {}", e))))?;
    FriendsApi::invite_to_server(is_experimental, &token, friend_uuid, &domain, user_uuid).await?;
    Ok(())
}

#[tauri::command]
pub async fn request_invite_to_server_command(friend_uuid: String) -> Result<(), CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friend_uuid = Uuid::parse_str(&friend_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid UUID: {}", e))))?;
    FriendsApi::request_invite_to_server(is_experimental, &token, friend_uuid, user_uuid).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_incoming_friend_requests_command(
) -> Result<Vec<FriendsFriendRequestResponse>, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friends_info =
        FriendsApi::get_friends_information(is_experimental, &token, user_uuid, user_uuid).await?;
    let converted_info = friends_info.into_converted();
    let incoming_requests: Vec<FriendsFriendRequestResponse> = converted_info
        .pending
        .into_iter()
        .filter(|request| request.friend_request.receiver == user_uuid)
        .filter(|request| request.friend_request.current_state.is_pending())
        .collect();

    Ok(incoming_requests)
}

#[tauri::command]
pub async fn get_outgoing_friend_requests_command(
) -> Result<Vec<FriendsFriendRequestResponse>, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friends_info =
        FriendsApi::get_friends_information(is_experimental, &token, user_uuid, user_uuid).await?;
    let converted_info = friends_info.into_converted();
    let outgoing_requests: Vec<FriendsFriendRequestResponse> = converted_info
        .pending
        .into_iter()
        .filter(|request| request.friend_request.sender == user_uuid)
        .filter(|request| request.friend_request.current_state.is_pending())
        .collect();

    Ok(outgoing_requests)
}

#[tauri::command]
pub async fn set_show_server_command(show_server: bool) -> Result<FriendsUser, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let result =
        FriendsApi::set_show_server(is_experimental, &token, show_server, user_uuid).await?;
    Ok(result)
}

#[tauri::command]
pub async fn set_allow_friend_requests_command(
    allow_requests: bool,
) -> Result<FriendsUser, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let result =
        FriendsApi::set_allow_friend_requests(is_experimental, &token, allow_requests, user_uuid)
            .await?;
    Ok(result)
}

#[tauri::command]
pub async fn set_allow_server_invites_command(
    allow_server_invites: bool,
) -> Result<FriendsUser, CommandError> {
    let state = State::get().await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let result = FriendsApi::set_allow_server_invites(
        is_experimental,
        &token,
        allow_server_invites,
        user_uuid,
    )
    .await?;
    Ok(result)
}

pub async fn refresh_friends_cache(state: &State) -> Result<(), CommandError> {
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    let friends_info =
        FriendsApi::get_friends_information(is_experimental, &token, user_uuid, user_uuid).await?;
    let converted_info = friends_info.into_converted();

    state
        .friends_manager
        .update_friends_list(converted_info)
        .await
        .map_err(|e| {
            CommandError::from(AppError::Other(format!(
                "Failed to update friends cache: {}",
                e
            )))
        })?;

    Ok(())
}

pub async fn refresh_messaging_cache(state: &State) -> Result<(), CommandError> {
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let (token, user_uuid) = get_token_and_uuid_from_state(&state).await?;
    
    // Refresh private chats
    let chats = crate::minecraft::api::messaging_api::MessagingApi::get_private_chats(
        is_experimental, 
        &token, 
        user_uuid
    ).await?;

    state
        .messaging_manager
        .update_chats(chats)
        .await
        .map_err(|e| {
            CommandError::from(AppError::Other(format!(
                "Failed to update messaging cache: {}",
                e
            )))
        })?;

    Ok(())
}

#[tauri::command]
pub async fn start_friends_websocket_command(
    window: tauri::WebviewWindow,
) -> Result<(), CommandError> {
    start_friends_websocket_auto(&window).await;
    Ok(())
}
