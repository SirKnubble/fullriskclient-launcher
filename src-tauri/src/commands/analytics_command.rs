use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use log::info;
use std::collections::HashMap;
use std::error::Error;
use tauri::command;
use crate::state::state_manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsEvent {
    #[serde(rename = "event_type")]
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "session_id")]
    pub session_id: String,
    #[serde(rename = "user_id")]
    pub user_id: String,
    pub properties: Option<HashMap<String, Value>>,
}

impl AnalyticsEvent {
    fn new(event_type: impl Into<String>, properties: Option<HashMap<String, Value>>) -> Self {
        let now = Utc::now();
        let session_id = format!("session_{}", now.timestamp());
        let user_id = format!("user_{}", now.timestamp());

        Self {
            event_type: event_type.into(),
            timestamp: now,
            session_id,
            user_id,
            properties,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackEventRequest {
    pub events: Vec<AnalyticsEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackEventResponse {
    pub success: bool,
    pub message: Option<String>,
}

fn string_value(value: impl Into<String>) -> Value {
    Value::String(value.into())
}

fn number_value(value: f64) -> Value {
    Value::Number(
        serde_json::Number::from_f64(value)
            .unwrap_or_else(|| serde_json::Number::from(0)),
    )
}

async fn dispatch_analytics_event(
    event_type: impl Into<String>,
    properties: HashMap<String, Value>,
) -> Result<(), String> {
    let event = AnalyticsEvent::new(event_type, Some(properties));
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_launcher_start_event(
    launcher_version: String,
    java_version: String,
    os: String,
    os_version: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("launcher_version".to_string(), string_value(launcher_version)),
        ("java_version".to_string(), string_value(java_version)),
        ("os".to_string(), string_value(os)),
        ("os_version".to_string(), string_value(os_version)),
    ]);

    dispatch_analytics_event("launcher_started", properties).await
}

pub async fn track_minecraft_started_event(
    profile_id: String,
    minecraft_version: String,
    loader: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("profile_id".to_string(), string_value(profile_id)),
        ("version".to_string(), string_value(minecraft_version)),
        ("loader".to_string(), string_value(loader)),
    ]);

    dispatch_analytics_event("minecraft_started", properties).await
}

pub async fn track_skin_added_event(
    skin_name: String,
    source_type: String,
    source_value: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("skin_name".to_string(), string_value(skin_name)),
        ("source".to_string(), string_value(source_type.clone())),
        ("source_type".to_string(), string_value(source_type)),
        ("source_value".to_string(), string_value(source_value)),
    ]);

    dispatch_analytics_event("skin_added", properties).await
}

pub async fn track_skin_deleted_event(
    skin_name: String,
) -> Result<(), String> {
    let properties = HashMap::from([("skin_name".to_string(), string_value(skin_name))]);

    dispatch_analytics_event("skin_deleted", properties).await
}

pub async fn track_skin_selected_event(
    skin_variant: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("skin_variant".to_string(), string_value(skin_variant.clone())),
        ("skin_type".to_string(), string_value(skin_variant.clone())),
        ("skin_name".to_string(), string_value(skin_variant)),
    ]);

    dispatch_analytics_event("skin_selected", properties).await
}

pub async fn track_skin_edited_event(
    skin_name: String,
    skin_variant: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("skin_name".to_string(), string_value(skin_name)),
        ("skin_variant".to_string(), string_value(skin_variant)),
        ("edit_type".to_string(), string_value("properties_updated".to_string())),
    ]);

    dispatch_analytics_event("skin_edited", properties).await
}

pub async fn track_cape_selected_event(
    cape_hash: String,
    cape_source: String,
    cape_name: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("cape_hash".to_string(), string_value(cape_hash)),
        ("cape_source".to_string(), string_value(cape_source)),
        ("cape_name".to_string(), string_value(cape_name)),
    ]);

    dispatch_analytics_event("cape_selected", properties).await
}

pub async fn track_profile_created_event(
    profile_name: String,
    game_version: String,
    loader: String,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("profile_name".to_string(), string_value(profile_name)),
        ("version".to_string(), string_value(game_version)),
        ("loader".to_string(), string_value(loader)),
    ]);

    dispatch_analytics_event("profile_created", properties).await
}

pub async fn track_profile_imported_event(
    profile_name: String,
) -> Result<(), String> {
    let properties = HashMap::from([("profile_name".to_string(), string_value(profile_name))]);

    dispatch_analytics_event("profile_imported", properties).await
}

pub async fn track_color_changed_event(
    color: String,
) -> Result<(), String> {
    let name = if color.trim().is_empty() {
        "Custom".to_string()
    } else {
        color
    };
    let properties = HashMap::from([
        ("color".to_string(), string_value(name.clone())),
        ("color_name".to_string(), string_value(name)),
    ]);

    dispatch_analytics_event("color_changed", properties).await
}

pub async fn track_beta_updates_toggled_event(
    enabled: bool,
) -> Result<(), String> {
    let properties = HashMap::from([("enabled".to_string(), Value::Bool(enabled))]);

    dispatch_analytics_event("beta_update_toggled", properties).await
}

pub async fn track_border_radius_changed_event(
    radius: f64,
) -> Result<(), String> {
    let properties = HashMap::from([
        ("radius".to_string(), number_value(radius)),
        ("radius_px".to_string(), number_value(radius)),
    ]);

    dispatch_analytics_event("border_radius_changed", properties).await
}

pub async fn track_tab_clicked_event(
    tab_name: String,
) -> Result<(), String> {
    let properties = HashMap::from([("tab_name".to_string(), string_value(tab_name))]);

    dispatch_analytics_event("sidebar_tab_clicked", properties).await
}

#[command]
pub async fn track_analytics_event(event: AnalyticsEvent) -> Result<TrackEventResponse, String> {
    info!("============== ANALYTICS EVENT RECEIVED ==============");
    info!("Event Type: {}", event.event_type);
    info!("Timestamp: {:?}", event.timestamp);
    info!("Session ID: {}", event.session_id);
    info!("User ID: {}", event.user_id);
    info!("Properties: {:?}", event.properties);

    // Check if analytics are enabled in config
    match state_manager::State::get().await {
        Ok(state) => {
            let config = state.config_manager.get_config().await;
            if !config.enable_analytics {
                info!("[Analytics] Analytics disabled in config - skipping event tracking");
                return Ok(TrackEventResponse {
                    success: true,
                    message: Some("Analytics disabled".to_string()),
                });
            }
        }
        Err(e) => {
            info!("[Analytics] Failed to get state for analytics check: {} - skipping event", e);
            return Ok(TrackEventResponse {
                success: true,
                message: Some("State unavailable".to_string()),
            });
        }
    }

    let mut event_with_timestamp = event.clone();
    event_with_timestamp.timestamp = Utc::now();

    let request_body = TrackEventRequest {
        events: vec![event_with_timestamp.clone()],
    };

    let url = "https://analytics-api-staging.norisk.gg/api/track";

    info!("[Analytics] Sending event to backend: {}", url);
    info!("[Analytics] Request body: {:?}", request_body);

    info!("[Analytics] Attempting HTTP POST request...");
    info!("[Analytics] Creating reqwest client with 30s timeout...");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| {
            info!("[Analytics] Failed to create client: {}", e);
            format!("Failed to create HTTP client: {}", e)
        })?;

    info!("[Analytics] Client created successfully!");
    info!("[Analytics] Sending POST request now...");
    let response_result = client
        .post(url)
        .json(&request_body)
        .send()
        .await;

    info!("[Analytics] Request completed! Processing result...");

    match response_result
    {
        Ok(response) => {
            let status = response.status();
            info!("[Analytics] HTTP Response received! Status: {}", status);
            if status.is_success() {
                info!("[Analytics] Event tracked successfully!");
                Ok(TrackEventResponse {
                    success: true,
                    message: Some("Event tracked successfully".to_string()),
                })
            } else {
                info!("[Analytics] Failed to track event. Status: {}", status);
                Ok(TrackEventResponse {
                    success: false,
                    message: Some(format!("Failed to track event: {}", status)),
                })
            }
        }
        Err(e) => {
            info!("[Analytics] ERROR: Failed to send event!");
            info!("[Analytics] Error details: {}", e);
            info!("[Analytics] Error source: {:?}", e.source());
            info!("[Analytics] Error type: {:?}", std::any::type_name_of_val(&e));
            Err(format!("Failed to send event: {}", e))
        }
    }
}
