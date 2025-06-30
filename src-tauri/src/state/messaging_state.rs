use crate::error::Result;
use crate::minecraft::api::messaging_api::{
    ChatMessage, ChatWithMetadata,
};
use crate::state::post_init::PostInitializationHandler;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagingCache {
    pub chats: Vec<ChatWithMetadata>,
    pub messages: std::collections::HashMap<String, Vec<ChatMessage>>,
    pub last_updated: i64,
}

impl Default for MessagingCache {
    fn default() -> Self {
        Self {
            chats: Vec::new(),
            messages: std::collections::HashMap::new(),
            last_updated: 0,
        }
    }
}

pub struct MessagingManager {
    cache_path: PathBuf,
    cache: Arc<RwLock<MessagingCache>>,
}

impl MessagingManager {
    pub fn new(cache_path: PathBuf) -> Result<Self> {
        let cache = if cache_path.exists() {
            let content = std::fs::read_to_string(&cache_path)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            MessagingCache::default()
        };

        Ok(Self {
            cache_path,
            cache: Arc::new(RwLock::new(cache)),
        })
    }

    pub async fn get_chats(&self) -> Result<Vec<ChatWithMetadata>> {
        let cache = self.cache.read().await;
        Ok(cache.chats.clone())
    }

    pub async fn get_chat_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>> {
        let cache = self.cache.read().await;
        Ok(cache.messages.get(chat_id).cloned().unwrap_or_default())
    }

    pub async fn update_chats(&self, chats: Vec<ChatWithMetadata>) -> Result<()> {
        let mut cache = self.cache.write().await;
        cache.chats = chats;
        cache.last_updated = chrono::Utc::now().timestamp();
        drop(cache);
        self.save_cache().await
    }

    pub async fn update_chat_messages(&self, chat_id: String, messages: Vec<ChatMessage>) -> Result<()> {
        let mut cache = self.cache.write().await;
        cache.messages.insert(chat_id, messages);
        cache.last_updated = chrono::Utc::now().timestamp();
        drop(cache);
        self.save_cache().await
    }

    pub async fn add_message(&self, chat_id: String, message: ChatMessage) -> Result<()> {
        let mut cache = self.cache.write().await;
        let messages = cache.messages.entry(chat_id).or_insert_with(Vec::new);
        
        let insert_pos = messages
            .binary_search_by(|m| m.created_at.cmp(&message.created_at))
            .unwrap_or_else(|e| e);
        messages.insert(insert_pos, message);
        
        cache.last_updated = chrono::Utc::now().timestamp();
        drop(cache);
        self.save_cache().await
    }

    pub async fn update_message(&self, chat_id: &str, updated_message: ChatMessage) -> Result<()> {
        let mut cache = self.cache.write().await;
        if let Some(messages) = cache.messages.get_mut(chat_id) {
            if let Some(pos) = messages.iter().position(|m| m.mongo_id == updated_message.mongo_id) {
                messages[pos] = updated_message;
                cache.last_updated = chrono::Utc::now().timestamp();
            }
        }
        drop(cache);
        self.save_cache().await
    }

    pub async fn remove_message(&self, chat_id: &str, message_id: &str) -> Result<()> {
        let mut cache = self.cache.write().await;
        if let Some(messages) = cache.messages.get_mut(chat_id) {
            messages.retain(|m| m.mongo_id != message_id);
            cache.last_updated = chrono::Utc::now().timestamp();
        }
        drop(cache);
        self.save_cache().await
    }

    pub async fn find_or_create_chat_for_friend(&self, friend_uuid: Uuid) -> Result<Option<String>> {
        let cache = self.cache.read().await;
        
        for chat in &cache.chats {
            if chat.other_participant == Some(friend_uuid.to_string()) {
                return Ok(Some(chat.chat.mongo_id.clone()));
            }
        }
        
        Ok(None)
    }

    pub async fn get_unread_message_count(&self) -> Result<i32> {
        let cache = self.cache.read().await;
        let total_unread = cache.chats.iter().map(|c| c.unread_count).sum();
        Ok(total_unread)
    }

    async fn save_cache(&self) -> Result<()> {
        let cache = self.cache.read().await;
        let content = serde_json::to_string_pretty(&*cache)?;
        std::fs::write(&self.cache_path, content)?;
        Ok(())
    }
}

#[async_trait]
impl PostInitializationHandler for MessagingManager {
    async fn on_state_ready(&self, _app_handle: Arc<tauri::AppHandle>) -> Result<()> {
        Ok(())
    }
}