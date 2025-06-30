use crate::{
    config::HTTP_CLIENT,
    error::{AppError, Result},
};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChatType {
    Private,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatParticipant {
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    pub joined_at: Option<i64>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    #[serde(rename = "_id", alias = "mongoId")]
    pub mongo_id: String,
    #[serde(rename = "type", alias = "chatType")]
    pub chat_type: ChatType,
    pub participants: Vec<ChatParticipant>,
    pub name: Option<String>,
    pub timestamp: Option<i64>,
    #[serde(rename = "groupAvatarUrl")]
    pub group_avatar_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    #[serde(rename = "_id", alias = "mongoId")]
    pub mongo_id: String,
    #[serde(alias = "chatId")]
    pub chat_id: String,
    #[serde(alias = "senderId")]
    pub sender_id: Uuid,
    pub content: String,
    #[serde(alias = "createdAt")]
    pub created_at: i64,
    #[serde(alias = "sentAt")]
    pub sent_at: Option<i64>,
    #[serde(alias = "editedAt")]
    pub edited_at: Option<i64>,
    #[serde(alias = "readAt")]
    pub read_at: Option<i64>,
    #[serde(alias = "receivedAt")]
    pub received_at: Option<i64>,
    #[serde(alias = "deletedAt")]
    pub deleted_at: Option<i64>,
    #[serde(alias = "relatesTo")]
    pub relates_to: Option<String>,
    pub reactions: Option<Vec<MessageReaction>>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageReaction {
    #[serde(rename(deserialize = "reactor", serialize = "userId"))]
    pub user_id: Uuid,
    #[serde(rename(deserialize = "emojiUnicode", serialize = "emoji"))]
    pub emoji: String,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePrivateChatRequest {
    pub recipient: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChatMessageRequest {
    pub content: String,
    #[serde(rename = "relatesTo")]
    pub relates_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditChatMessageRequest {
    #[serde(rename = "messageID")]
    pub message_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteChatMessageRequest {
    #[serde(rename = "messageID")]
    pub message_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactToChatMessageRequest {
    pub emoji: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkMessageReceivedRequest {
    #[serde(rename = "messageID")]
    pub message_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatWithMetadata {
    #[serde(flatten)]
    pub chat: Chat,
    #[serde(rename = "otherParticipant")]
    pub other_participant: Option<String>,
    #[serde(rename = "latestMessage", alias = "lastMessage")]
    pub last_message: Option<ChatMessage>,
    #[serde(rename = "unreadMessages", alias = "unreadCount")]
    pub unread_count: i32,
}

pub struct MessagingApi;

impl MessagingApi {
    fn get_api_base(is_experimental: bool) -> String {
        if is_experimental {
            "https://api-staging.norisk.gg/api/v1".to_string()
        } else {
            "https://api.norisk.gg/api/v1".to_string()
        }
    }

    async fn make_request(
        method: reqwest::Method,
        url: &str,
        token: &str,
        player_uuid: Uuid,
        body: Option<serde_json::Value>,
    ) -> Result<reqwest::Response> {
        let mut request = HTTP_CLIENT
            .request(method, url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .query(&[("uuid", player_uuid.to_string())]);

        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::Other(format!("HTTP request failed: {}", e)))?;

        Ok(response)
    }

    async fn handle_response<T: for<'de> Deserialize<'de>>(
        response: reqwest::Response,
        operation: &str,
    ) -> Result<T> {
        let status = response.status();

        if status == StatusCode::NOT_FOUND && operation.contains("get") {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Other(format!("{} not found (404) - might be normal if no data exists", operation)));
        }

        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::Other(
                "Unauthorized access to messaging API".to_string(),
            ));
        }

        let response_text = response.text().await.map_err(|e| {
            AppError::Other(format!("Failed to read {} response: {}", operation, e))
        })?;

        if !status.is_success() {
            return Err(AppError::Other(format!(
                "{} failed with status {}: {}",
                operation, status, response_text
            )));
        }

        serde_json::from_str(&response_text).map_err(|e| {
            AppError::Other(format!(
                "Failed to parse {} response: {}. Raw response: {}",
                operation, e, response_text
            ))
        })
    }

    pub async fn create_private_chat(
        is_experimental: bool,
        token: &str,
        recipient_uuid: Uuid,
        player_uuid: Uuid,
    ) -> Result<Chat> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/private", base_url);

        let body = serde_json::json!(CreatePrivateChatRequest {
            recipient: recipient_uuid
        });

        let response = Self::make_request(reqwest::Method::POST, &url, token, player_uuid, Some(body)).await?;
        Self::handle_response(response, "create private chat").await
    }

    pub async fn get_private_chats(
        is_experimental: bool,
        token: &str,
        player_uuid: Uuid,
    ) -> Result<Vec<ChatWithMetadata>> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/private", base_url);

        let response = Self::make_request(reqwest::Method::GET, &url, token, player_uuid, None).await?;
        Self::handle_response::<Vec<ChatWithMetadata>>(response, "get private chats").await
    }

    pub async fn get_private_chat_for_friend(
        is_experimental: bool,
        token: &str,
        friend_uuid: Uuid,
        player_uuid: Uuid,
    ) -> Result<ChatWithMetadata> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/private/{}", base_url, friend_uuid);

        let response = Self::make_request(reqwest::Method::GET, &url, token, player_uuid, None).await?;
        Self::handle_response(response, "get private chat for friend").await
    }

    pub async fn send_message(
        is_experimental: bool,
        token: &str,
        chat_id: &str,
        content: &str,
        relates_to: Option<String>,
        player_uuid: Uuid,
    ) -> Result<ChatMessage> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/{}/messages", base_url, chat_id);

        let body = serde_json::json!(CreateChatMessageRequest {
            content: content.to_string(),
            relates_to,
        });

        let response = Self::make_request(reqwest::Method::POST, &url, token, player_uuid, Some(body)).await?;
        Self::handle_response::<ChatMessage>(response, "send message").await
    }

    pub async fn edit_message(
        is_experimental: bool,
        token: &str,
        chat_id: &str,
        message_id: &str,
        content: &str,
        player_uuid: Uuid,
    ) -> Result<ChatMessage> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/{}/messages", base_url, chat_id);

        let body = serde_json::json!(EditChatMessageRequest {
            message_id: message_id.to_string(),
            content: content.to_string(),
        });

        let response = Self::make_request(reqwest::Method::PUT, &url, token, player_uuid, Some(body)).await?;
        Self::handle_response(response, "edit message").await
    }

    pub async fn delete_message(
        is_experimental: bool,
        token: &str,
        chat_id: &str,
        message_id: &str,
        player_uuid: Uuid,
    ) -> Result<()> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/{}/messages", base_url, chat_id);

        let body = serde_json::json!(DeleteChatMessageRequest {
            message_id: message_id.to_string(),
        });

        let response = Self::make_request(reqwest::Method::DELETE, &url, token, player_uuid, Some(body)).await?;
        
        let status = response.status();
        if !status.is_success() {
            let response_text = response.text().await.unwrap_or_default();
            return Err(AppError::Other(format!(
                "Delete message failed with status {}: {}",
                status, response_text
            )));
        }

        Ok(())
    }

    pub async fn get_messages(
        is_experimental: bool,
        token: &str,
        chat_id: &str,
        page: Option<i32>,
        player_uuid: Uuid,
    ) -> Result<Vec<ChatMessage>> {
        let base_url = Self::get_api_base(is_experimental);
        let page_num = page.unwrap_or(0);
        let url = format!("{}/messaging/chat/{}/messages?page={}", base_url, chat_id, page_num);

        let response = Self::make_request(reqwest::Method::GET, &url, token, player_uuid, None).await?;
        Self::handle_response::<Vec<ChatMessage>>(response, "get messages").await
    }

    pub async fn react_to_message(
        is_experimental: bool,
        token: &str,
        message_id: &str,
        emoji: &str,
        player_uuid: Uuid,
    ) -> Result<ChatMessage> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/message/{}/reaction", base_url, message_id);

        let body = serde_json::json!(ReactToChatMessageRequest {
            emoji: emoji.to_string(),
        });

        let response = Self::make_request(reqwest::Method::POST, &url, token, player_uuid, Some(body)).await?;
        Self::handle_response(response, "react to message").await
    }

    pub async fn remove_reaction(
        is_experimental: bool,
        token: &str,
        message_id: &str,
        player_uuid: Uuid,
    ) -> Result<ChatMessage> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/message/{}/reaction", base_url, message_id);

        let response = Self::make_request(reqwest::Method::DELETE, &url, token, player_uuid, None).await?;
        Self::handle_response(response, "remove reaction").await
    }

    pub async fn mark_message_received(
        is_experimental: bool,
        token: &str,
        chat_id: &str,
        message_id: &str,
        player_uuid: Uuid,
    ) -> Result<ChatMessage> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/messaging/chat/{}/messages/received", base_url, chat_id);

        let body = serde_json::json!(MarkMessageReceivedRequest {
            message_id: message_id.to_string(),
        });

        let response = Self::make_request(reqwest::Method::POST, &url, token, player_uuid, Some(body)).await?;
        Self::handle_response(response, "mark message received").await
    }
}
