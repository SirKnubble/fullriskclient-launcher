use crate::error::Result;
use crate::minecraft::api::friends_api::{
    FriendsFriendRequestResponse, FriendsFriendsInformationConverted, FriendsPrivacySettings,
    FriendsUser,
};
use crate::state::post_init::PostInitializationHandler;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendsCache {
    pub friends: Vec<FriendsUser>,
    pub friend_requests: Vec<FriendsFriendRequestResponse>,
    pub hosted_worlds: Vec<serde_json::Value>,
}

impl Default for FriendsCache {
    fn default() -> Self {
        Self {
            friends: Vec::new(),
            friend_requests: Vec::new(),
            hosted_worlds: Vec::new(),
        }
    }
}

pub struct FriendsManager {
    cache_path: PathBuf,
    cache: Arc<RwLock<FriendsCache>>,
}

impl FriendsManager {
    pub fn new(cache_path: PathBuf) -> Result<Self> {
        let cache = if cache_path.exists() {
            let content = std::fs::read_to_string(&cache_path)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            FriendsCache::default()
        };

        Ok(Self {
            cache_path,
            cache: Arc::new(RwLock::new(cache)),
        })
    }
    pub async fn update_friends_list(
        &self,
        friends_info: FriendsFriendsInformationConverted,
    ) -> Result<()> {
        let mut cache = self.cache.write().await;

        cache.friends = friends_info
            .friends
            .into_iter()
            .map(|friend_user| {
                let online_state = friend_user.online_state.clone();
                FriendsUser {
                    user_id: friend_user.norisk_user.uuid,
                    requests: Vec::new(),
                    other_users: std::collections::HashMap::new(),
                    state: friend_user.online_state,
                    last_active_state: online_state,
                    server: friend_user.server,
                    privacy: FriendsPrivacySettings {
                        show_server: true,
                        allow_requests: true,
                        allow_server_invites: true,
                    },
                }
            })
            .collect();

        cache.friend_requests = friends_info.pending;

        drop(cache);
        self.save_cache().await
    }

    async fn save_cache(&self) -> Result<()> {
        let cache = self.cache.read().await;
        let content = serde_json::to_string_pretty(&*cache)?;
        std::fs::write(&self.cache_path, content)?;
        Ok(())
    }
}

#[async_trait]
impl PostInitializationHandler for FriendsManager {
    async fn on_state_ready(&self, app_handle: Arc<tauri::AppHandle>) -> Result<()> {
        Ok(())
    }
}
