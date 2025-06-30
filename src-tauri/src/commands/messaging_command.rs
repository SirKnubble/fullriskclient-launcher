use crate::error::{AppError, CommandError};
use crate::minecraft::api::messaging_api::{
    Chat, ChatMessage, ChatWithMetadata, MessagingApi,
};
use crate::state::state_manager::State;
use uuid::Uuid;

async fn get_token_and_uuid_from_state(state: &State) -> Result<(String, Uuid), CommandError> {
    let credentials = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| CommandError::from(AppError::NoCredentialsError))?;
    
    let is_experimental = state.config_manager.is_experimental_mode().await;
    let token = credentials
        .norisk_credentials
        .get_token_for_mode(is_experimental)
        .map_err(|e| CommandError::from(AppError::Other(format!("Failed to get NoRisk token: {}", e))))?;
    
    let user_uuid = credentials.id;
    Ok((token, user_uuid))
}

#[tauri::command]
pub async fn get_private_chats_command() -> Result<Vec<ChatWithMetadata>, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let chats = MessagingApi::get_private_chats(is_experimental, &token, uuid).await?;
    
    state.messaging_manager.update_chats(chats.clone()).await?;
    
    Ok(chats)
}

#[tauri::command]
pub async fn get_private_chat_for_friend_command(friend_uuid: String) -> Result<ChatWithMetadata, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let friend_uuid = Uuid::parse_str(&friend_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid friend UUID: {}", e))))?;
    
    let chat = MessagingApi::get_private_chat_for_friend(is_experimental, &token, friend_uuid, uuid).await?;
    
    Ok(chat)
}

#[tauri::command]
pub async fn create_private_chat_command(recipient_uuid: String) -> Result<Chat, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let recipient_uuid = Uuid::parse_str(&recipient_uuid)
        .map_err(|e| CommandError::from(AppError::Other(format!("Invalid recipient UUID: {}", e))))?;
    
    let chat = MessagingApi::create_private_chat(is_experimental, &token, recipient_uuid, uuid).await?;
    
    Ok(chat)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn send_message_command(
    chatId: String,
    content: String,
    relatesTo: Option<String>,
) -> Result<ChatMessage, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let message = MessagingApi::send_message(is_experimental, &token, &chatId, &content, relatesTo, uuid).await?;
    
    state.messaging_manager.add_message(chatId, message.clone()).await?;
    
    Ok(message)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn edit_message_command(
    chatId: String,
    messageId: String,
    content: String,
) -> Result<ChatMessage, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let message = MessagingApi::edit_message(is_experimental, &token, &chatId, &messageId, &content, uuid).await?;
    
    state.messaging_manager.update_message(&chatId, message.clone()).await?;
    
    Ok(message)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn delete_message_command(
    chatId: String,
    messageId: String,
) -> Result<(), CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    MessagingApi::delete_message(is_experimental, &token, &chatId, &messageId, uuid).await?;
    
    state.messaging_manager.remove_message(&chatId, &messageId).await?;
    
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_messages_command(
    chatId: String,
    page: Option<i32>,
) -> Result<Vec<ChatMessage>, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let messages = MessagingApi::get_messages(is_experimental, &token, &chatId, page, uuid).await?;
    
    state.messaging_manager.update_chat_messages(chatId.clone(), messages.clone()).await?;
    
    Ok(messages)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn react_to_message_command(
    messageId: String,
    emoji: String,
) -> Result<ChatMessage, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let message = MessagingApi::react_to_message(is_experimental, &token, &messageId, &emoji, uuid).await?;
    
    Ok(message)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn remove_reaction_command(
    messageId: String,
) -> Result<ChatMessage, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let message = MessagingApi::remove_reaction(is_experimental, &token, &messageId, uuid).await?;
    
    Ok(message)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn mark_message_as_read_command(
    chatId: String,
    messageId: String,
) -> Result<ChatMessage, CommandError> {
    let state = State::get().await?;
    let (token, uuid) = get_token_and_uuid_from_state(&state).await?;
    let is_experimental = state.config_manager.is_experimental_mode().await;
    
    let message = MessagingApi::mark_message_received(is_experimental, &token, &chatId, &messageId, uuid).await?;
    
    Ok(message)
}

#[tauri::command]
pub async fn get_cached_chats_command() -> Result<Vec<ChatWithMetadata>, CommandError> {
    let state = State::get().await?;
    let chats = state.messaging_manager.get_chats().await?;
    
    Ok(chats)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_cached_messages_command(chatId: String) -> Result<Vec<ChatMessage>, CommandError> {
    let state = State::get().await?;
    let messages = state.messaging_manager.get_chat_messages(&chatId).await?;
    
    Ok(messages)
}

#[tauri::command]
pub async fn get_unread_count_command() -> Result<i32, CommandError> {
    let state = State::get().await?;
    let count = state.messaging_manager.get_unread_message_count().await?;
    
    Ok(count)
}
