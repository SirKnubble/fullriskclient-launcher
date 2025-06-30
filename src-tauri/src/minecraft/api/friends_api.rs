use crate::{
    config::HTTP_CLIENT,
    error::{AppError, Result},
};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoRiskUserMinimal {
    pub uuid: Uuid,
    pub ign: String,
    #[serde(default)]
    pub display_name: Option<String>,
    pub last_seen: Option<String>,
    pub discord_id: Option<String>,
    pub rank: Option<String>,
    pub no_risk_plus_expiration_date: Option<i64>,
    #[serde(default)]
    pub name_tag: serde_json::Value,
    #[serde(default)]
    pub login_streak: serde_json::Value,
    #[serde(default)]
    pub custom_icon_info: serde_json::Value,
    #[serde(default)]
    pub additional_name_tag: serde_json::Value,
    pub support_a_creator_code: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoRiskUserFull {
    pub uuid: Uuid,
    pub ign: String,
    pub display_name: String,
    pub premium: bool,
    pub norisk_plus: bool,
    pub created_at: i64,
    pub last_seen: i64,
    pub mc_uuid: Option<Uuid>,
    pub mc_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FriendsUserOnlineState {
    Online,
    Offline,
    Afk,
    Busy,
    Invisible,
}

impl FriendsUserOnlineState {
    pub fn from_string(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "ONLINE" => Self::Online,
            "OFFLINE" => Self::Offline,
            "AFK" => Self::Afk,
            "BUSY" => Self::Busy,
            "INVISIBLE" => Self::Invisible,
            _ => Self::Offline,
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            Self::Online => "ONLINE".to_string(),
            Self::Offline => "OFFLINE".to_string(),
            Self::Afk => "AFK".to_string(),
            Self::Busy => "BUSY".to_string(),
            Self::Invisible => "INVISIBLE".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsPrivacySettings {
    #[serde(default = "default_true")]
    pub show_server: bool,
    #[serde(default = "default_true")]
    pub allow_requests: bool,
    #[serde(default = "default_true")]
    pub allow_server_invites: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FriendsFriendRequestState {
    #[serde(rename = "gg.norisk.networking.model.friends.FriendsFriendRequestState.Accepted")]
    Accepted {
        #[serde(default)]
        timestamp: i64,
        #[serde(default)]
        actor: Option<Uuid>,
        #[serde(default)]
        name: Option<String>,
    },
    #[serde(rename = "gg.norisk.networking.model.friends.FriendsFriendRequestState.Withdrawn")]
    Withdrawn {
        #[serde(default)]
        timestamp: i64,
        #[serde(default)]
        actor: Option<Uuid>,
        #[serde(default)]
        name: Option<String>,
    },
    #[serde(rename = "gg.norisk.networking.model.friends.FriendsFriendRequestState.Denied")]
    Denied {
        #[serde(default)]
        timestamp: i64,
        #[serde(default)]
        actor: Option<Uuid>,
        #[serde(default)]
        name: Option<String>,
    },
    #[serde(rename = "gg.norisk.networking.model.friends.FriendsFriendRequestState.Pending")]
    Pending {
        #[serde(default)]
        timestamp: i64,
        #[serde(default)]
        actor: Option<Uuid>,
        #[serde(default)]
        name: Option<String>,
    },
    #[serde(rename = "gg.norisk.networking.model.friends.FriendsFriendRequestState.None")]
    None {
        #[serde(default)]
        timestamp: i64,
    },
}

impl FriendsFriendRequestState {
    pub fn is_pending(&self) -> bool {
        matches!(self, FriendsFriendRequestState::Pending { .. })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtherNoRiskUser {
    pub user_id: String,
    pub requests: Vec<String>,
    pub other_users: std::collections::HashMap<String, OtherNoRiskUser>,
    pub state: String,
    pub last_active_state: String,
    pub server: Option<String>,
    pub privacy: FriendsPrivacySettings,
    pub created_at: Option<i64>,
    pub last_updated: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendsUser {
    #[serde(rename(deserialize = "_id", serialize = "userId"))]
    pub user_id: Uuid,
    pub requests: Vec<String>,
    #[serde(rename = "otherUsers")]
    pub other_users: std::collections::HashMap<Uuid, OtherNoRiskUser>,
    pub state: FriendsUserOnlineState,
    #[serde(rename = "lastActiveState")]
    pub last_active_state: FriendsUserOnlineState,
    pub server: Option<String>,
    pub privacy: FriendsPrivacySettings,
}

impl FriendsUser {
    pub fn get_converted_other_users(&self) -> std::collections::HashMap<String, OtherNoRiskUser> {
        self.other_users
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiUserResponse {
    pub norisk_user: NoRiskUserMinimal,
    pub requests: Vec<String>,
    pub other_users: std::collections::HashMap<String, OtherNoRiskUser>,
    pub state: String,
    pub last_active_state: String,
    pub server: Option<String>,
    pub privacy: FriendsPrivacySettings,
    pub created_at: Option<i64>,
    pub last_updated: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsFriendUser {
    pub norisk_user: NoRiskUserMinimal,
    pub other_user: FriendsOtherUserSimple,
    pub online_state: FriendsUserOnlineState,
    pub server: Option<String>,
}

impl FriendsFriendUser {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsFriendRequest {
    pub sender: Uuid,
    pub receiver: Uuid,
    pub current_state: FriendsFriendRequestState,
    pub previous_state: Option<FriendsFriendRequestState>,
    pub timestamp: i64,
    #[serde(rename = "_id")]
    pub mongo_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsFriendRequestResponse {
    pub friend_request: FriendsFriendRequest,
    pub users: Vec<NoRiskUserMinimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsFriendsInformationDto {
    pub friends: Vec<FriendsFriendUser>,
    pub pending: Vec<FriendsFriendRequestResponse>,
    pub user: ApiUserResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsFriendsListResponse {
    pub friends: Vec<FriendsRawFriendUser>,
    pub pending: Vec<FriendsFriendRequestResponse>,
}

impl FriendsFriendsListResponse {
    pub fn into_friends_information_dto(
        self,
        user: ApiUserResponse,
    ) -> FriendsFriendsInformationDto {
        let converted_friends: Vec<FriendsFriendUser> = self
            .friends
            .into_iter()
            .map(|raw_friend| {
                let online_state_enum = match raw_friend.online_state.to_uppercase().as_str() {
                    "ONLINE" => FriendsUserOnlineState::Online,
                    "OFFLINE" => FriendsUserOnlineState::Offline,
                    "BUSY" => FriendsUserOnlineState::Busy,
                    "AFK" | "IDLE" => FriendsUserOnlineState::Afk,
                    "INVISIBLE" => FriendsUserOnlineState::Invisible,
                    _ => FriendsUserOnlineState::Offline,
                };
                let other_user = FriendsOtherUserSimple {
                    uuid: raw_friend.other_user.uuid.clone(),
                };

                FriendsFriendUser {
                    norisk_user: raw_friend.norisk_user,
                    other_user,
                    online_state: online_state_enum,
                    server: raw_friend.server,
                }
            })
            .collect();

        FriendsFriendsInformationDto {
            friends: converted_friends,
            pending: self.pending,
            user,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsFriendsInformationConverted {
    pub friends: Vec<FriendsFriendUser>,
    pub pending: Vec<FriendsFriendRequestResponse>,
    pub user: FriendsUser,
}

impl FriendsFriendsInformationDto {
    pub fn into_converted(self) -> FriendsFriendsInformationConverted {
        let mut converted_other_users = std::collections::HashMap::new();
        for (uuid_str, other_user) in self.user.other_users {
            if let Ok(uuid) = uuid_str.parse::<Uuid>() {
                converted_other_users.insert(uuid, other_user);
            }
        }

        FriendsFriendsInformationConverted {
            friends: self.friends,
            pending: self.pending,
            user: FriendsUser {
                user_id: self.user.norisk_user.uuid,
                requests: self.user.requests,
                other_users: converted_other_users,
                state: FriendsUserOnlineState::from_string(&self.user.state),
                last_active_state: FriendsUserOnlineState::from_string(
                    &self.user.last_active_state,
                ),
                server: self.user.server,
                privacy: self.user.privacy,
            },
        }
    }
}

pub struct FriendsApi;

impl FriendsApi {
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

        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::Other(
                "Unauthorized access to friends API".to_string(),
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
    async fn handle_friends_user_response(
        response: reqwest::Response,
        operation: &str,
    ) -> Result<FriendsUser> {
        let status = response.status();

        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::Other(
                "Unauthorized access to friends API".to_string(),
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

        let api_response: FriendsUserApiResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                AppError::Other(format!(
                    "Failed to parse {} response: {}. Raw response: {}",
                    operation, e, response_text
                ))
            })?;

        api_response.to_friends_user()
    }
    pub async fn get_own_user(
        is_experimental: bool,
        token: &str,
        player_uuid: Uuid,
    ) -> Result<FriendsUser> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/user", base_url);

        let response =
            Self::make_request(reqwest::Method::GET, &url, token, player_uuid, None).await?;
        let own_user_response: FriendsOwnUserResponse =
            Self::handle_response(response, "get own user").await?;

        Ok(own_user_response.into_friends_user())
    }
    pub async fn get_friends_information(
        is_experimental: bool,
        token: &str,
        user_uuid: Uuid,
        player_uuid: Uuid,
    ) -> Result<FriendsFriendsInformationDto> {
        let user_info = Self::get_own_user(is_experimental, token, player_uuid).await?;

        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/{}", base_url, user_uuid);

        let response =
            Self::make_request(reqwest::Method::GET, &url, token, player_uuid, None).await?;
        let friends_list: FriendsFriendsListResponse =
            Self::handle_response(response, "get friends information").await?;

        Ok(friends_list.into_friends_information_dto(ApiUserResponse {
            norisk_user: NoRiskUserMinimal {
                uuid: user_info.user_id,
                ign: user_info.user_id.to_string(),
                display_name: None,
                last_seen: None,
                discord_id: None,
                rank: None,
                no_risk_plus_expiration_date: None,
                name_tag: serde_json::Value::Null,
                login_streak: serde_json::Value::Null,
                custom_icon_info: serde_json::Value::Null,
                additional_name_tag: serde_json::Value::Null,
                support_a_creator_code: None,
            },
            requests: user_info.requests.clone(),
            other_users: user_info.get_converted_other_users(),
            state: user_info.state.to_string(),
            last_active_state: user_info.last_active_state.to_string(),
            server: user_info.server.clone(),
            privacy: user_info.privacy.clone(),
            created_at: None,
            last_updated: None,
        }))
    }

    pub async fn accept_friend_request(
        is_experimental: bool,
        token: &str,
        friend_uuid: Uuid,
        player_uuid: Uuid,
    ) -> Result<FriendsFriendRequestResponse> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/{}/add", base_url, friend_uuid);

        let response =
            Self::make_request(reqwest::Method::POST, &url, token, player_uuid, None).await?;
        Self::handle_response(response, "accept friend request").await
    }

    pub async fn remove_friend(
        is_experimental: bool,
        token: &str,
        friend_uuid: Uuid,
        player_uuid: Uuid,
    ) -> Result<FriendsFriendRequestResponse> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/{}/remove", base_url, friend_uuid);

        let response =
            Self::make_request(reqwest::Method::DELETE, &url, token, player_uuid, None).await?;
        Self::handle_response(response, "remove friend").await
    }
    pub async fn invite_to_server(
        is_experimental: bool,
        token: &str,
        friend_uuid: Uuid,
        domain: &str,
        player_uuid: Uuid,
    ) -> Result<()> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/invite/{}", base_url, friend_uuid);

        let response = HTTP_CLIENT
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .query(&[
                ("uuid", player_uuid.to_string()),
                ("domain", domain.to_string()),
            ])
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Invite to server request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Other(format!(
                "Invite to server failed with status {}",
                response.status()
            )));
        }
        Ok(())
    }

    pub async fn toggle_afk(
        is_experimental: bool,
        token: &str,
        now_afk: bool,
        player_uuid: Uuid,
    ) -> Result<FriendsUserOnlineState> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/status/afk", base_url);

        let response = HTTP_CLIENT
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .query(&[
                ("uuid", player_uuid.to_string()),
                ("now_afk", now_afk.to_string()),
            ])
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Toggle AFK request failed: {}", e)))?;

        Self::handle_response(response, "toggle afk").await
    }
    pub async fn set_server(
        is_experimental: bool,
        token: &str,
        server: &str,
        player_uuid: Uuid,
    ) -> Result<FriendsUser> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/server", base_url);

        let body = serde_json::json!(server);
        let response =
            Self::make_request(reqwest::Method::POST, &url, token, player_uuid, Some(body)).await?;
        Self::handle_friends_user_response(response, "set server").await
    }

    pub async fn remove_server(
        is_experimental: bool,
        token: &str,
        player_uuid: Uuid,
    ) -> Result<FriendsUser> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/server", base_url);

        let response =
            Self::make_request(reqwest::Method::DELETE, &url, token, player_uuid, None).await?;
        Self::handle_friends_user_response(response, "remove server").await
    }
    pub async fn set_show_server(
        is_experimental: bool,
        token: &str,
        show_server: bool,
        player_uuid: Uuid,
    ) -> Result<FriendsUser> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/privacy/show-server", base_url);

        let body = serde_json::json!(show_server);
        let response =
            Self::make_request(reqwest::Method::PUT, &url, token, player_uuid, Some(body)).await?;
        Self::handle_friends_user_response(response, "set show server").await
    }

    pub async fn set_allow_friend_requests(
        is_experimental: bool,
        token: &str,
        allow_friend_requests: bool,
        player_uuid: Uuid,
    ) -> Result<FriendsUser> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/privacy/allow-friend-requests", base_url);

        let body = serde_json::json!(allow_friend_requests);
        let response =
            Self::make_request(reqwest::Method::PUT, &url, token, player_uuid, Some(body)).await?;
        Self::handle_friends_user_response(response, "set allow friend requests").await
    }

    pub async fn set_allow_server_invites(
        is_experimental: bool,
        token: &str,
        allow_server_invites: bool,
        player_uuid: Uuid,
    ) -> Result<FriendsUser> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/privacy/allow-server-invites", base_url);

        let body = serde_json::json!(allow_server_invites);
        let response =
            Self::make_request(reqwest::Method::PUT, &url, token, player_uuid, Some(body)).await?;
        Self::handle_friends_user_response(response, "set allow server invites").await
    }

    pub async fn request_invite_to_server(
        is_experimental: bool,
        token: &str,
        friend_uuid: Uuid,
        player_uuid: Uuid,
    ) -> Result<()> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/friends/invite/request/{}", base_url, friend_uuid);

        let response =
            Self::make_request(reqwest::Method::POST, &url, token, player_uuid, None).await?;

        if !response.status().is_success() {
            return Err(AppError::Other(format!(
                "Request invite to server failed with status {}",
                response.status()
            )));
        }

        Ok(())
    }

    pub async fn refresh_friend_states(
        is_experimental: bool,
        token: &str,
        player_uuid: Uuid,
    ) -> Result<Vec<FriendsFriendUser>> {
        let friends_info =
            Self::get_friends_information(is_experimental, token, player_uuid, player_uuid).await?;
        Ok(friends_info.friends)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsOnlineStateChangeDto {
    pub user: NoRiskUserMinimal,
    pub new_state: FriendsUserOnlineState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsRequestServerInviteDto {
    pub from: NoRiskUserMinimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsHostInvite {
    pub from: NoRiskUserMinimal,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsOwnUserResponse {
    #[serde(rename = "_id")]
    pub user_id: Uuid,
    pub requests: Vec<String>,
    pub other_users: std::collections::HashMap<String, serde_json::Value>,
    pub state: String,
    pub last_active_state: String,
    pub server: Option<String>,
    pub privacy: FriendsPrivacySettings,
}

impl FriendsOwnUserResponse {
    pub fn into_friends_user(self) -> FriendsUser {
        let mut converted_other_users = std::collections::HashMap::new();
        for (uuid_str, other_user_data) in self.other_users {
            if let Ok(uuid) = uuid_str.parse::<Uuid>() {
                let (state, last_active_state, server, privacy) = if let Ok(parsed_data) =
                    serde_json::from_value::<OtherNoRiskUser>(other_user_data)
                {
                    (
                        parsed_data.state,
                        parsed_data.last_active_state,
                        parsed_data.server,
                        parsed_data.privacy,
                    )
                } else {
                    (
                        "OFFLINE".to_string(),
                        "OFFLINE".to_string(),
                        None,
                        FriendsPrivacySettings {
                            show_server: true,
                            allow_requests: true,
                            allow_server_invites: true,
                        },
                    )
                };

                let simplified_other_user = OtherNoRiskUser {
                    user_id: uuid_str.clone(),
                    requests: Vec::new(),
                    other_users: std::collections::HashMap::new(),
                    state,
                    last_active_state,
                    server,
                    privacy,
                    created_at: None,
                    last_updated: None,
                };
                converted_other_users.insert(uuid, simplified_other_user);
            }
        }

        FriendsUser {
            user_id: self.user_id,
            requests: self.requests,
            other_users: converted_other_users,
            state: FriendsUserOnlineState::from_string(&self.state),
            last_active_state: FriendsUserOnlineState::from_string(&self.last_active_state),
            server: self.server,
            privacy: self.privacy,
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FriendsOtherUserSimple {
    pub uuid: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FriendsRawFriendUser {
    pub norisk_user: NoRiskUserMinimal,
    pub other_user: FriendsOtherUserSimple,
    pub online_state: String,
    pub server: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendsUserApiResponse {
    #[serde(rename = "_id")]
    pub user_id: String,
    pub requests: Vec<String>,
    #[serde(rename = "otherUsers")]
    pub other_users: std::collections::HashMap<String, serde_json::Value>,
    pub state: String,
    #[serde(rename = "lastActiveState")]
    pub last_active_state: String,
    pub server: Option<String>,
    pub privacy: FriendsPrivacySettings,
}

impl FriendsUserApiResponse {
    pub fn to_friends_user(self) -> Result<FriendsUser> {
        let user_uuid = Uuid::parse_str(&self.user_id)
            .map_err(|e| AppError::Other(format!("Invalid user UUID: {}", e)))?;
        let mut other_users_map = std::collections::HashMap::new();

        for (uuid_str, value) in self.other_users {
            if let Ok(uuid) = Uuid::parse_str(&uuid_str) {
                if let Ok(other_user) = serde_json::from_value::<OtherNoRiskUser>(value) {
                    other_users_map.insert(uuid, other_user);
                }
            }
        }

        Ok(FriendsUser {
            user_id: user_uuid,
            requests: self.requests,
            other_users: other_users_map,
            state: FriendsUserOnlineState::from_string(&self.state),
            last_active_state: FriendsUserOnlineState::from_string(&self.last_active_state),
            server: self.server,
            privacy: self.privacy,
        })
    }
}
