use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;
use serde_json::Value;
use chrono::{DateTime, Utc};
use log::info;
use std::error::Error;

pub async fn track_launcher_start_event(
    launcher_version: String,
    java_version: String,
    os: String,
    os_version: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("launcher_version".to_string(), Value::String(launcher_version));
    properties.insert("java_version".to_string(), Value::String(java_version));
    properties.insert("os".to_string(), Value::String(os));
    properties.insert("os_version".to_string(), Value::String(os_version));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "launcher_started".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_minecraft_started_event(
    profile_id: String,
    minecraft_version: String,
    loader: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("profile_id".to_string(), Value::String(profile_id));
    properties.insert("minecraft_version".to_string(), Value::String(minecraft_version));
    properties.insert("loader".to_string(), Value::String(loader));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "minecraft_started".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_skin_added_event(
    skin_name: String,
    source_type: String,
    source_value: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("skin_name".to_string(), Value::String(skin_name));
    properties.insert("source_type".to_string(), Value::String(source_type));
    properties.insert("source_value".to_string(), Value::String(source_value));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "skin_added".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_skin_deleted_event(
    skin_name: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("skin_name".to_string(), Value::String(skin_name));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "skin_deleted".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_skin_selected_event(
    skin_variant: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("skin_variant".to_string(), Value::String(skin_variant));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "skin_selected".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_skin_edited_event(
    skin_name: String,
    skin_variant: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("skin_name".to_string(), Value::String(skin_name));
    properties.insert("skin_variant".to_string(), Value::String(skin_variant));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "skin_edited".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_cape_selected_event(
    cape_hash: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("cape_hash".to_string(), Value::String(cape_hash));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "cape_selected".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_profile_created_event(
    profile_name: String,
    game_version: String,
    loader: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("profile_name".to_string(), Value::String(profile_name));
    properties.insert("game_version".to_string(), Value::String(game_version));
    properties.insert("loader".to_string(), Value::String(loader));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "profile_created".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_profile_imported_event(
    profile_name: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("profile_name".to_string(), Value::String(profile_name));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "profile_imported".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_color_changed_event(
    color: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("color".to_string(), Value::String(color));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "color_changed".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_beta_updates_toggled_event(
    enabled: bool,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("enabled".to_string(), Value::Bool(enabled));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "beta_updates_toggled".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_border_radius_changed_event(
    radius: f64,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("radius".to_string(), Value::Number(
        serde_json::Number::from_f64(radius).unwrap_or_else(|| serde_json::Number::from(0))
    ));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "border_radius_changed".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

pub async fn track_tab_clicked_event(
    tab_name: String,
) -> Result<(), String> {
    let mut properties = HashMap::new();
    properties.insert("tab_name".to_string(), Value::String(tab_name));
    
    // Generate session_id and user_id (simple implementation)
    let session_id = format!("session_{}", Utc::now().timestamp());
    let user_id = format!("user_{}", Utc::now().timestamp());
    
    let event = AnalyticsEvent {
        event_type: "tab_clicked".to_string(),
        timestamp: Utc::now(),
        session_id: session_id.clone(),
        user_id: user_id.clone(),
        properties: Some(properties),
    };
    
    track_analytics_event(event).await.map(|_| ())
}

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

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackEventRequest {
    pub events: Vec<AnalyticsEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackEventResponse {
    pub success: bool,
    pub message: Option<String>,
}

#[command]
pub async fn track_analytics_event(event: AnalyticsEvent) -> Result<TrackEventResponse, String> {
    info!("============== ANALYTICS EVENT RECEIVED ==============");
    info!("Event Type: {}", event.event_type);
    info!("Timestamp: {:?}", event.timestamp);
    info!("Session ID: {}", event.session_id);
    info!("User ID: {}", event.user_id);
    info!("Properties: {:?}", event.properties);
    
    let mut event_with_timestamp = event.clone();
    event_with_timestamp.timestamp = Utc::now();
    
    let request_body = TrackEventRequest {
        events: vec![event_with_timestamp.clone()],
    };
    
    let url = "https://track.norisk.gg/api/track";
    
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
