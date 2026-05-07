use crate::config::{ProjectDirsExt, HTTP_CLIENT, LAUNCHER_DIRECTORY};
use crate::error::{AppError, CommandError};
use crate::minecraft::auth::minecraft_auth::Credentials;
use crate::minecraft::downloads::java_download::JavaDownloadService;
use crate::minecraft::dto::java_distribution::JavaDistribution;
use crate::state::state_manager::State;
use crate::utils::java_detector::detect_java_installations;
use crate::utils::path_utils::calculate_dir_size_recursively;
use async_compression::tokio::bufread::GzipDecoder;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use fastnbt::from_bytes;
use futures_util::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const CUSTOM_SERVER_API_BASE: &str = "https://fullrisk.net/api/v1";

static RUNNING_CUSTOM_SERVERS: Lazy<Mutex<HashMap<String, RunningCustomServer>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static CUSTOM_SERVER_LOGS: Lazy<Mutex<HashMap<String, Vec<String>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static FULLRISK_AUTH_SESSION: Lazy<Mutex<Option<FullRiskAuthSession>>> =
    Lazy::new(|| Mutex::new(None));

struct RunningCustomServer {
    stdin: tokio::process::ChildStdin,
    started_at: Instant,
    forwarding_session_id: Option<String>,
    forwarding_agent: Option<JoinHandle<()>>,
}

struct FullRiskAuthSession {
    owner: String,
    token: String,
    expires_at: Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum CustomServerType {
    Vanilla,
    Forge,
    Fabric,
    #[serde(rename = "NEO_FORGE")]
    NeoForge,
    Quilt,
    Paper,
    Spigot,
    Bukkit,
    Folia,
    Purpur,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomServer {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub owner: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    #[serde(rename = "loaderVersion")]
    pub loader_version: Option<String>,
    pub r#type: CustomServerType,
    pub domain: String,
    pub subdomain: String,
    #[serde(rename = "hostIp")]
    pub host_ip: Option<String>,
    pub port: Option<u16>,
    #[serde(rename = "lastOnline")]
    pub last_online: u64,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<u64>,
    #[serde(rename = "deletedBy")]
    pub deleted_by: Option<String>,
    #[serde(rename = "deletionReason")]
    pub deletion_reason: Option<String>,
    #[serde(rename = "originalName")]
    pub original_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomServersResponse {
    pub limit: i32,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub servers: Vec<CustomServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomServerBlacklistEntry {
    pub uuid: String,
    pub reason: String,
    pub blocked_at: u64,
    pub blocked_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminCustomServersResponse {
    pub limit: i32,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub servers: Vec<CustomServer>,
    pub blacklist: Vec<CustomServerBlacklistEntry>,
}

#[derive(Debug, Serialize)]
struct BlockCustomServerOwnerRequest<'a> {
    reason: &'a str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomServerEventPayload {
    pub server_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomServerStats {
    pub running: bool,
    pub uptime_seconds: u64,
    pub size_bytes: u64,
    pub mod_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledServerAddon {
    pub file_name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateCustomServerRequest<'a> {
    name: &'a str,
    mc_version: &'a str,
    loader_version: Option<&'a str>,
    r#type: &'a str,
    subdomain: &'a str,
    port: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCustomServerRequest<'a> {
    name: &'a str,
    mc_version: &'a str,
    loader_version: Option<&'a str>,
    r#type: &'a str,
    subdomain: &'a str,
    port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomServerProperties {
    pub motd: String,
    pub max_players: u32,
    pub difficulty: String,
    pub gamemode: String,
    pub online_mode: bool,
    pub pvp: bool,
    pub allow_flight: bool,
    pub view_distance: u32,
    pub simulation_distance: u32,
    pub spawn_protection: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerFileTreeEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub children: Vec<ServerFileTreeEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomServerWorldInfo {
    pub folder_name: String,
    pub display_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub game_day: Option<i64>,
    pub last_played: Option<i64>,
    pub version_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomServerArchiveManifest {
    pub name: String,
    pub mc_version: String,
    pub loader_version: Option<String>,
    pub r#type: CustomServerType,
    pub exported_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomServerImportPreview {
    pub name: String,
    pub mc_version: String,
    pub loader_version: Option<String>,
    pub r#type: CustomServerType,
    pub addon_count: usize,
    pub world_count: usize,
    pub size_bytes: u64,
}

#[derive(Debug, Deserialize)]
struct ServerLevelDat {
    #[serde(rename = "Data")]
    data: ServerLevelData,
}

#[derive(Debug, Deserialize)]
struct ServerLevelData {
    #[serde(rename = "LevelName")]
    level_name: Option<String>,
    #[serde(rename = "DayTime")]
    day_time: Option<i64>,
    #[serde(rename = "Time")]
    time: Option<i64>,
    #[serde(rename = "LastPlayed")]
    last_played: Option<i64>,
    #[serde(rename = "Version")]
    version: Option<ServerVersionData>,
}

#[derive(Debug, Deserialize)]
struct ServerVersionData {
    #[serde(rename = "Name")]
    name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartForwardingRequest<'a> {
    local_host: &'a str,
    local_port: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthChallengeResponse {
    challenge_id: String,
    server_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MinecraftJoinRequest<'a> {
    access_token: &'a str,
    selected_profile: String,
    server_id: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthVerifyRequest<'a> {
    challenge_id: &'a str,
    username: &'a str,
    uuid: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthVerifyResponse {
    token: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    error: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ForwardingSession {
    id: Option<String>,
    mode: Option<String>,
    address: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    #[serde(rename = "wsUrl")]
    ws_url: Option<String>,
    #[serde(rename = "localHost")]
    local_host: Option<String>,
    #[serde(rename = "localPort")]
    local_port: Option<u16>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentOutgoingMessage {
    r#type: String,
    conn_id: Option<String>,
    data: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VersionManifest {
    versions: Vec<VersionManifestEntry>,
}

#[derive(Debug, Deserialize)]
struct VersionManifestEntry {
    id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct VersionMetadata {
    downloads: VersionDownloads,
    #[serde(rename = "javaVersion")]
    java_version: Option<MinecraftJavaVersion>,
}

#[derive(Debug, Deserialize)]
struct VersionDownloads {
    server: Option<VersionDownload>,
}

#[derive(Debug, Deserialize)]
struct VersionDownload {
    url: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftJavaVersion {
    #[serde(rename = "majorVersion")]
    major_version: u32,
}

async fn active_account() -> Result<Credentials, CommandError> {
    let state = State::get().await?;
    let account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?
        .ok_or_else(|| AppError::AccountError("No active account found.".to_string()))?;

    Ok(account)
}

async fn custom_server_auth_token(
    account: &Credentials,
    force_refresh: bool,
) -> Result<String, CommandError> {
    let owner = account.id.to_string();
    if !force_refresh {
        let cached = FULLRISK_AUTH_SESSION.lock().await;
        if let Some(session) = cached.as_ref() {
            if session.owner == owner
                && session.expires_at > Instant::now() + std::time::Duration::from_secs(30)
            {
                return Ok(session.token.clone());
            }
        }
    }

    let challenge = HTTP_CLIENT
        .post(endpoint("launcher/auth/challenge"))
        .query(&[("uuid", owner.as_str())])
        .send()
        .await
        .map_err(AppError::from)?;
    let challenge = read_api_response::<AuthChallengeResponse>(
        challenge,
        "Failed to start account verification",
    )
    .await?;

    let join_response = HTTP_CLIENT
        .post("https://sessionserver.mojang.com/session/minecraft/join")
        .json(&MinecraftJoinRequest {
            access_token: &account.access_token,
            selected_profile: account.id.simple().to_string(),
            server_id: &challenge.server_id,
        })
        .send()
        .await
        .map_err(AppError::from)?;
    if !join_response.status().is_success() {
        return Err(CommandError::from(AppError::Other(
            "Minecraft account verification failed. Please restart the launcher or sign in again."
                .to_string(),
        )));
    }

    let verify = HTTP_CLIENT
        .post(endpoint("launcher/auth/verify"))
        .query(&[("uuid", owner.as_str())])
        .json(&AuthVerifyRequest {
            challenge_id: &challenge.challenge_id,
            username: &account.username,
            uuid: account.id.simple().to_string(),
        })
        .send()
        .await
        .map_err(AppError::from)?;
    let verify =
        read_api_response::<AuthVerifyResponse>(verify, "Failed to verify Minecraft account")
            .await?;

    let expires_in = verify.expires_in.saturating_sub(30).max(30);
    let mut cached = FULLRISK_AUTH_SESSION.lock().await;
    *cached = Some(FullRiskAuthSession {
        owner,
        token: verify.token.clone(),
        expires_at: Instant::now() + std::time::Duration::from_secs(expires_in),
    });

    Ok(verify.token)
}

async fn invalidate_custom_server_auth_token() {
    *FULLRISK_AUTH_SESSION.lock().await = None;
}

fn endpoint(path: &str) -> String {
    format!("{}/{}", CUSTOM_SERVER_API_BASE.trim_end_matches('/'), path)
}

async fn read_api_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
    context: &str,
) -> Result<T, CommandError> {
    let status = response.status();
    if status.is_success() {
        return response
            .json::<T>()
            .await
            .map_err(AppError::from)
            .map_err(Into::into);
    }
    if status == reqwest::StatusCode::UNAUTHORIZED {
        *FULLRISK_AUTH_SESSION.lock().await = None;
    }

    let body = response.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<ApiErrorBody>(&body)
        .ok()
        .and_then(|parsed| parsed.error.or(parsed.message))
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| {
            if body.trim().is_empty() {
                status.to_string()
            } else {
                body.trim().to_string()
            }
        });

    Err(AppError::Other(format!("{}: {}", context, detail)).into())
}

async fn authenticated_api_response<T, F>(
    account: &Credentials,
    context: &str,
    build_request: F,
) -> Result<T, CommandError>
where
    T: for<'de> Deserialize<'de>,
    F: Fn(&str) -> reqwest::RequestBuilder,
{
    let token = custom_server_auth_token(account, false).await?;
    let response = build_request(&token).send().await.map_err(AppError::from)?;

    if response.status() != reqwest::StatusCode::UNAUTHORIZED {
        return read_api_response::<T>(response, context).await;
    }

    invalidate_custom_server_auth_token().await;
    let token = custom_server_auth_token(account, true).await?;
    let response = build_request(&token).send().await.map_err(AppError::from)?;

    read_api_response::<T>(response, context).await
}

async fn ensure_api_success(
    response: reqwest::Response,
    context: &str,
) -> Result<(), CommandError> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    if status == reqwest::StatusCode::UNAUTHORIZED {
        *FULLRISK_AUTH_SESSION.lock().await = None;
    }

    let body = response.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<ApiErrorBody>(&body)
        .ok()
        .and_then(|parsed| parsed.error.or(parsed.message))
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| {
            if body.trim().is_empty() {
                status.to_string()
            } else {
                body.trim().to_string()
            }
        });

    Err(AppError::Other(format!("{}: {}", context, detail)).into())
}

async fn authenticated_api_success<F>(
    account: &Credentials,
    context: &str,
    build_request: F,
) -> Result<(), CommandError>
where
    F: Fn(&str) -> reqwest::RequestBuilder,
{
    let token = custom_server_auth_token(account, false).await?;
    let response = build_request(&token).send().await.map_err(AppError::from)?;

    if response.status() != reqwest::StatusCode::UNAUTHORIZED {
        return ensure_api_success(response, context).await;
    }

    invalidate_custom_server_auth_token().await;
    let token = custom_server_auth_token(account, true).await?;
    let response = build_request(&token).send().await.map_err(AppError::from)?;

    ensure_api_success(response, context).await
}

#[tauri::command]
pub async fn get_custom_servers() -> Result<CustomServersResponse, CommandError> {
    let account = active_account().await?;
    authenticated_api_response::<CustomServersResponse, _>(
        &account,
        "Failed to load custom servers",
        |token| {
            HTTP_CLIENT
                .get(endpoint("launcher/custom-servers"))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
        },
    )
    .await
}

#[tauri::command]
pub async fn check_custom_server_subdomain(subdomain: String) -> Result<bool, CommandError> {
    let account = active_account().await?;
    authenticated_api_response::<bool, _>(&account, "Failed to check subdomain", |token| {
        HTTP_CLIENT
            .get(endpoint("launcher/custom-servers/check-subdomain"))
            .header("Authorization", format!("Bearer {}", token))
            .query(&[
                ("uuid", account.id.to_string()),
                ("subdomain", subdomain.clone()),
            ])
    })
    .await
}

#[tauri::command]
pub async fn create_custom_server(
    name: String,
    mc_version: String,
    loader_version: Option<String>,
    r#type: String,
    subdomain: String,
    port: u16,
) -> Result<CustomServer, CommandError> {
    let account = active_account().await?;
    let body = CreateCustomServerRequest {
        name: &name,
        mc_version: &mc_version,
        loader_version: loader_version.as_deref(),
        r#type: &r#type,
        subdomain: &subdomain,
        port,
    };
    authenticated_api_response::<CustomServer, _>(
        &account,
        "Failed to create custom server",
        |token| {
            HTTP_CLIENT
                .post(endpoint("launcher/custom-servers"))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
                .json(&body)
        },
    )
    .await
}

#[tauri::command]
pub async fn update_custom_server(
    id: String,
    name: String,
    mc_version: String,
    loader_version: Option<String>,
    r#type: String,
    subdomain: String,
    port: u16,
) -> Result<CustomServer, CommandError> {
    let account = active_account().await?;
    let body = UpdateCustomServerRequest {
        name: &name,
        mc_version: &mc_version,
        loader_version: loader_version.as_deref(),
        r#type: &r#type,
        subdomain: &subdomain,
        port,
    };
    authenticated_api_response::<CustomServer, _>(
        &account,
        "Failed to update custom server",
        |token| {
            HTTP_CLIENT
                .patch(endpoint(&format!("launcher/custom-servers/{}", id)))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
                .json(&body)
        },
    )
    .await
}

#[tauri::command]
pub async fn delete_custom_server(id: String) -> Result<(), CommandError> {
    let account = active_account().await?;
    authenticated_api_success(&account, "Failed to delete custom server", |token| {
        HTTP_CLIENT
            .delete(endpoint(&format!("launcher/custom-servers/{}", id)))
            .header("Authorization", format!("Bearer {}", token))
            .query(&[("uuid", account.id.to_string())])
    })
    .await
}

#[tauri::command]
pub async fn get_admin_custom_servers() -> Result<AdminCustomServersResponse, CommandError> {
    let account = active_account().await?;
    authenticated_api_response::<AdminCustomServersResponse, _>(
        &account,
        "Failed to load admin custom servers",
        |token| {
            HTTP_CLIENT
                .get(endpoint("admin/moderation/custom-servers"))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
        },
    )
    .await
}

#[tauri::command]
pub async fn admin_delete_custom_server(id: String) -> Result<CustomServer, CommandError> {
    let account = active_account().await?;
    authenticated_api_response::<CustomServer, _>(
        &account,
        "Failed to delete custom server as admin",
        |token| {
            HTTP_CLIENT
                .delete(endpoint(&format!("admin/moderation/custom-servers/{}", id)))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
        },
    )
    .await
}

#[tauri::command]
pub async fn admin_restore_custom_server(id: String) -> Result<CustomServer, CommandError> {
    let account = active_account().await?;
    authenticated_api_response::<CustomServer, _>(
        &account,
        "Failed to restore custom server as admin",
        |token| {
            HTTP_CLIENT
                .post(endpoint(&format!(
                    "admin/moderation/custom-servers/{}/restore",
                    id
                )))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
        },
    )
    .await
}

#[tauri::command]
pub async fn admin_block_custom_server_owner(
    id: String,
    reason: Option<String>,
) -> Result<(), CommandError> {
    let account = active_account().await?;
    let reason = reason.unwrap_or_else(|| "Blocked by admin moderation".to_string());
    authenticated_api_success(&account, "Failed to block custom server owner", |token| {
        HTTP_CLIENT
            .post(endpoint(&format!(
                "admin/moderation/custom-servers/{}/block-owner",
                id
            )))
            .header("Authorization", format!("Bearer {}", token))
            .query(&[("uuid", account.id.to_string())])
            .json(&BlockCustomServerOwnerRequest { reason: &reason })
    })
    .await
}

#[tauri::command]
pub async fn admin_unblock_custom_server_owner(owner: String) -> Result<(), CommandError> {
    let account = active_account().await?;
    authenticated_api_success(&account, "Failed to unblock custom server owner", |token| {
        HTTP_CLIENT
            .delete(endpoint(&format!("admin/moderation/blacklist/{}", owner)))
            .header("Authorization", format!("Bearer {}", token))
            .query(&[("uuid", account.id.to_string())])
    })
    .await
}

#[tauri::command]
pub async fn run_custom_server(
    app: AppHandle,
    custom_server: CustomServer,
    forwarding_enabled: Option<bool>,
) -> Result<(), CommandError> {
    {
        let running = RUNNING_CUSTOM_SERVERS.lock().await;
        if running.contains_key(&custom_server.id) {
            emit_custom_server_log(&app, &custom_server.id, "[INFO] Server is already running");
            return Ok(());
        }
    }

    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!(
            "[INFO] Preparing {} server '{}'",
            custom_server.type_name(),
            custom_server.name
        ),
    );

    if !matches!(&custom_server.r#type, CustomServerType::Vanilla) {
        emit_custom_server_log(
            &app,
            &custom_server.id,
            &format!(
                "[WARN] Starting {} as a vanilla jar for now. Loader-specific providers still need to be wired.",
                custom_server.type_name()
            ),
        );
    }

    let server_dir = custom_server_dir(&custom_server)?;
    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!("[DEBUG] Server directory: {}", server_dir.display()),
    );
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;
    emit_custom_server_log(
        &app,
        &custom_server.id,
        "[DEBUG] Writing eula.txt and server.properties",
    );
    prepare_server_files(&custom_server, &server_dir)
        .await
        .map_err(AppError::from)?;

    emit_custom_server_log(
        &app,
        &custom_server.id,
        "[INFO] Resolving Minecraft server jar",
    );
    let (jar_path, required_java_major) =
        ensure_vanilla_server_jar(&app, &custom_server, &server_dir)
            .await
            .map_err(AppError::from)?;
    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!("[DEBUG] Server jar: {}", jar_path.display()),
    );
    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!(
            "[INFO] Resolving Java runtime for Java {}",
            required_java_major
        ),
    );
    let java_path = resolve_server_java(&app, &custom_server.id, required_java_major)
        .await
        .map_err(AppError::from)?;

    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!(
            "[INFO] Launching Minecraft server process with Java {} ({})",
            required_java_major,
            java_path.display()
        ),
    );
    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!(
            "[INFO] Connection address: {}.{}:{}",
            custom_server.subdomain,
            custom_server.domain,
            custom_server.port.unwrap_or(25565)
        ),
    );

    let mut child = Command::new(java_path)
        .arg("-Xms1G")
        .arg("-Xmx2G")
        .arg("-jar")
        .arg(jar_path)
        .arg("nogui")
        .current_dir(&server_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(AppError::from)?;
    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!("[INFO] Server process spawned with pid {:?}", child.id()),
    );

    let mut forwarding_agent = None;
    let forwarding_session = if forwarding_enabled.unwrap_or(true) {
        match start_custom_server_forwarding(&custom_server).await {
            Ok(session) => {
                let display_address = session
                    .address
                    .clone()
                    .or_else(|| {
                        session.host.as_ref().map(|host| {
                            session
                                .port
                                .map(|port| format!("{}:{}", host, port))
                                .unwrap_or_else(|| host.clone())
                        })
                    })
                    .unwrap_or_else(|| {
                        format!(
                            "{}.{}:{}",
                            custom_server.subdomain,
                            custom_server.domain,
                            custom_server.port.unwrap_or(25565)
                        )
                    });
                emit_custom_server_log(
                    &app,
                    &custom_server.id,
                    &format!("[INFO] Forwarding online at {}", display_address),
                );
                if let Some(ws_url) = session.ws_url.clone() {
                    emit_custom_server_log(
                        &app,
                        &custom_server.id,
                        &format!(
                            "[INFO] Starting websocket forwarding agent for local {}:{}",
                            session.local_host.as_deref().unwrap_or("127.0.0.1"),
                            session
                                .local_port
                                .unwrap_or(custom_server.port.unwrap_or(25565))
                        ),
                    );
                    forwarding_agent = Some(spawn_forwarding_agent(
                        app.clone(),
                        custom_server.id.clone(),
                        ws_url,
                    ));
                }
                session.id
            }
            Err(error) => {
                let _ = child.kill().await;
                emit_custom_server_log(
                    &app,
                    &custom_server.id,
                    &format!("[ERROR] Forwarding tunnel failed: {}", error),
                );
                return Err(AppError::Other(format!("Forwarding tunnel failed: {}", error)).into());
            }
        }
    } else {
        emit_custom_server_log(
            &app,
            &custom_server.id,
            "[WARN] Forwarding tunnel disabled. Players may not be able to join through the FullRisk subdomain, and your public IP is not hidden if you connect directly.",
        );
        None
    };

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::ProcessError("Failed to open server stdin".to_string()))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    RUNNING_CUSTOM_SERVERS.lock().await.insert(
        custom_server.id.clone(),
        RunningCustomServer {
            stdin,
            started_at: Instant::now(),
            forwarding_session_id: forwarding_session,
            forwarding_agent,
        },
    );

    if let Some(stdout) = stdout {
        emit_custom_server_log(
            &app,
            &custom_server.id,
            "[DEBUG] Attached stdout log reader",
        );
        pipe_process_output(app.clone(), custom_server.id.clone(), stdout);
    }
    if let Some(stderr) = stderr {
        emit_custom_server_log(
            &app,
            &custom_server.id,
            "[DEBUG] Attached stderr log reader",
        );
        pipe_process_output(app.clone(), custom_server.id.clone(), stderr);
    }

    let app_for_wait = app.clone();
    let server_id = custom_server.id.clone();
    let custom_server_for_wait = custom_server.clone();
    tokio::spawn(async move {
        match child.wait().await {
            Ok(status) => emit_custom_server_log(
                &app_for_wait,
                &server_id,
                &format!("[INFO] Server process exited with status {}", status),
            ),
            Err(error) => emit_custom_server_log(
                &app_for_wait,
                &server_id,
                &format!("[ERROR] Server process wait failed: {}", error),
            ),
        }

        let removed_server = RUNNING_CUSTOM_SERVERS.lock().await.remove(&server_id);
        if let Some(agent) = removed_server
            .as_ref()
            .and_then(|server| server.forwarding_agent.as_ref())
        {
            agent.abort();
        }
        let forwarding_session_id = removed_server.and_then(|server| server.forwarding_session_id);
        if let Some(session_id) = forwarding_session_id {
            if let Err(error) =
                stop_custom_server_forwarding(&custom_server_for_wait, &session_id).await
            {
                emit_custom_server_log(
                    &app_for_wait,
                    &server_id,
                    &format!("[WARN] Failed to stop forwarding session: {}", error),
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn terminate_custom_server(
    server_id: Option<String>,
    launcher_was_closed: bool,
) -> Result<(), CommandError> {
    let mut running = RUNNING_CUSTOM_SERVERS.lock().await;

    if running.is_empty() {
        return Ok(());
    }

    let ids = if let Some(server_id) = server_id {
        vec![server_id]
    } else {
        running.keys().cloned().collect()
    };

    for id in ids {
        let Some(server) = running.get_mut(&id) else {
            continue;
        };
        let command = if launcher_was_closed {
            "stop\n"
        } else {
            "stop\n"
        };
        server
            .stdin
            .write_all(command.as_bytes())
            .await
            .map_err(AppError::from)?;
        server.stdin.flush().await.map_err(AppError::from)?;
        let _ = launcher_was_closed;
    }

    Ok(())
}

async fn start_custom_server_forwarding(
    custom_server: &CustomServer,
) -> Result<ForwardingSession, AppError> {
    let account = active_account()
        .await
        .map_err(|error| AppError::Other(error.message))?;
    let body = StartForwardingRequest {
        local_host: "127.0.0.1",
        local_port: custom_server.port.unwrap_or(25565),
    };

    authenticated_api_response::<ForwardingSession, _>(
        &account,
        "Failed to start forwarding",
        |token| {
            HTTP_CLIENT
                .post(endpoint(&format!(
                    "launcher/custom-servers/{}/forwarding/start",
                    custom_server.id
                )))
                .header("Authorization", format!("Bearer {}", token))
                .query(&[("uuid", account.id.to_string())])
                .json(&body)
        },
    )
    .await
    .map_err(|error| AppError::Other(error.message))
}

async fn stop_custom_server_forwarding(
    custom_server: &CustomServer,
    session_id: &str,
) -> Result<(), AppError> {
    let account = active_account()
        .await
        .map_err(|error| AppError::Other(error.message))?;

    authenticated_api_success(&account, "Failed to stop forwarding", |token| {
        HTTP_CLIENT
            .post(endpoint(&format!(
                "launcher/custom-servers/{}/forwarding/stop",
                custom_server.id
            )))
            .header("Authorization", format!("Bearer {}", token))
            .query(&[("uuid", account.id.to_string())])
            .json(&serde_json::json!({ "sessionId": session_id }))
    })
    .await
    .map_err(|error| AppError::Other(error.message))
}

fn spawn_forwarding_agent(app: AppHandle, server_id: String, ws_url: String) -> JoinHandle<()> {
    tokio::spawn(async move {
        if let Err(error) = run_forwarding_agent(app.clone(), server_id.clone(), ws_url).await {
            emit_custom_server_log(
                &app,
                &server_id,
                &format!("[WARN] Forwarding agent stopped: {}", error),
            );
        }
    })
}

async fn run_forwarding_agent(
    app: AppHandle,
    server_id: String,
    ws_url: String,
) -> Result<(), AppError> {
    let (ws_stream, _) = connect_async(&ws_url).await.map_err(|error| {
        AppError::Other(format!("Failed to connect forwarding websocket: {}", error))
    })?;
    emit_custom_server_log(&app, &server_id, "[INFO] Forwarding agent connected");

    let (mut ws_write, mut ws_read) = ws_stream.split();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<AgentOutgoingMessage>();
    let connections: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<Vec<u8>>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let writer = tokio::spawn(async move {
        while let Some(payload) = out_rx.recv().await {
            let Ok(text) = serde_json::to_string(&payload) else {
                continue;
            };
            if ws_write.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    while let Some(message) = ws_read.next().await {
        let message = message.map_err(|error| {
            AppError::Other(format!("Forwarding websocket read failed: {}", error))
        })?;
        let Message::Text(text) = message else {
            if matches!(message, Message::Close(_)) {
                break;
            }
            continue;
        };

        let payload: serde_json::Value = serde_json::from_str(&text)
            .map_err(|error| AppError::Other(format!("Invalid forwarding message: {}", error)))?;
        let message_type = payload
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or_default();

        match message_type {
            "open" => {
                let Some(conn_id) = payload.get("connId").and_then(|value| value.as_str()) else {
                    continue;
                };
                let host = payload
                    .get("host")
                    .and_then(|value| value.as_str())
                    .unwrap_or("127.0.0.1")
                    .to_string();
                let port = payload
                    .get("port")
                    .and_then(|value| value.as_u64())
                    .and_then(|value| u16::try_from(value).ok())
                    .unwrap_or(25565);

                open_forwarded_connection(
                    app.clone(),
                    server_id.clone(),
                    conn_id.to_string(),
                    host,
                    port,
                    out_tx.clone(),
                    connections.clone(),
                )
                .await;
            }
            "data" => {
                let Some(conn_id) = payload.get("connId").and_then(|value| value.as_str()) else {
                    continue;
                };
                let Some(data) = payload.get("data").and_then(|value| value.as_str()) else {
                    continue;
                };
                let Ok(bytes) = BASE64_STANDARD.decode(data) else {
                    continue;
                };
                if let Some(tx) = connections.lock().await.get(conn_id) {
                    let _ = tx.send(bytes);
                }
            }
            "close" => {
                if let Some(conn_id) = payload.get("connId").and_then(|value| value.as_str()) {
                    connections.lock().await.remove(conn_id);
                }
            }
            "shutdown" => break,
            _ => {}
        }
    }

    writer.abort();
    Ok(())
}

async fn open_forwarded_connection(
    app: AppHandle,
    server_id: String,
    conn_id: String,
    host: String,
    port: u16,
    out_tx: mpsc::UnboundedSender<AgentOutgoingMessage>,
    connections: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<Vec<u8>>>>>,
) {
    match TcpStream::connect((host.as_str(), port)).await {
        Ok(stream) => {
            let (mut read_half, mut write_half) = stream.into_split();
            let (tcp_tx, mut tcp_rx) = mpsc::unbounded_channel::<Vec<u8>>();
            connections.lock().await.insert(conn_id.clone(), tcp_tx);

            let conn_id_for_writer = conn_id.clone();
            let out_tx_for_writer = out_tx.clone();
            tokio::spawn(async move {
                while let Some(bytes) = tcp_rx.recv().await {
                    if write_half.write_all(&bytes).await.is_err() {
                        break;
                    }
                }
                let _ = out_tx_for_writer.send(AgentOutgoingMessage {
                    r#type: "close".to_string(),
                    conn_id: Some(conn_id_for_writer),
                    data: None,
                    message: None,
                });
            });

            let conn_id_for_reader = conn_id.clone();
            let connections_for_reader = connections.clone();
            tokio::spawn(async move {
                let mut buffer = vec![0u8; 16 * 1024];
                loop {
                    match read_half.read(&mut buffer).await {
                        Ok(0) => break,
                        Ok(read) => {
                            let _ = out_tx.send(AgentOutgoingMessage {
                                r#type: "data".to_string(),
                                conn_id: Some(conn_id_for_reader.clone()),
                                data: Some(BASE64_STANDARD.encode(&buffer[..read])),
                                message: None,
                            });
                        }
                        Err(_) => break,
                    }
                }
                connections_for_reader
                    .lock()
                    .await
                    .remove(&conn_id_for_reader);
                let _ = out_tx.send(AgentOutgoingMessage {
                    r#type: "close".to_string(),
                    conn_id: Some(conn_id_for_reader),
                    data: None,
                    message: None,
                });
            });
        }
        Err(error) => {
            emit_custom_server_log(
                &app,
                &server_id,
                &format!("[WARN] Forwarding connection failed: {}", error),
            );
            let _ = out_tx.send(AgentOutgoingMessage {
                r#type: "error".to_string(),
                conn_id: Some(conn_id),
                data: None,
                message: Some(error.to_string()),
            });
        }
    }
}

#[tauri::command]
pub async fn execute_rcon_command(
    server_id: String,
    timestamp: String,
    log_type: String,
    command: String,
) -> Result<(), CommandError> {
    let mut running = RUNNING_CUSTOM_SERVERS.lock().await;
    let server = running
        .get_mut(&server_id)
        .ok_or_else(|| AppError::ProcessError("Server is not running".to_string()))?;

    let line = format!("{}\n", command.trim());
    server
        .stdin
        .write_all(line.as_bytes())
        .await
        .map_err(AppError::from)?;
    server.stdin.flush().await.map_err(AppError::from)?;

    let _ = (timestamp, log_type);
    Ok(())
}

#[tauri::command]
pub async fn get_custom_server_stats(server_id: String) -> Result<CustomServerStats, CommandError> {
    let running = RUNNING_CUSTOM_SERVERS.lock().await;
    let (is_running, uptime_seconds) = running
        .get(&server_id)
        .map(|server| (true, server.started_at.elapsed().as_secs()))
        .unwrap_or((false, 0));

    Ok(CustomServerStats {
        running: is_running,
        uptime_seconds,
        size_bytes: 0,
        mod_count: 0,
    })
}

#[tauri::command]
pub async fn get_custom_server_details_stats(
    custom_server: CustomServer,
) -> Result<CustomServerStats, CommandError> {
    let running = RUNNING_CUSTOM_SERVERS.lock().await;
    let (is_running, uptime_seconds) = running
        .get(&custom_server.id)
        .map(|server| (true, server.started_at.elapsed().as_secs()))
        .unwrap_or((false, 0));
    drop(running);

    let server_dir = custom_server_dir(&custom_server)?;
    let size_bytes = if server_dir.exists() {
        calculate_dir_size_recursively(&server_dir).await?
    } else {
        0
    };

    let mod_count = list_installed_server_addons(custom_server).await?.len();

    Ok(CustomServerStats {
        running: is_running,
        uptime_seconds,
        size_bytes,
        mod_count,
    })
}

#[tauri::command]
pub async fn get_custom_server_logs(server_id: String) -> Result<Vec<String>, CommandError> {
    Ok(CUSTOM_SERVER_LOGS
        .lock()
        .await
        .get(&server_id)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
pub async fn get_custom_server_folder(custom_server: CustomServer) -> Result<String, CommandError> {
    Ok(custom_server_dir(&custom_server)?
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
pub async fn open_custom_server_folder(
    app: AppHandle,
    custom_server: CustomServer,
) -> Result<(), CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;
    app.opener()
        .open_path(server_dir.to_string_lossy(), None::<&str>)
        .map_err(|error| AppError::Other(format!("Failed to open server folder: {}", error)))?;
    Ok(())
}

#[tauri::command]
pub async fn open_custom_server_path(
    app: AppHandle,
    custom_server: CustomServer,
    path: String,
) -> Result<(), CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    let target = PathBuf::from(path);
    if !target.starts_with(&server_dir) {
        return Err(
            AppError::InvalidInput("Path is outside this server folder".to_string()).into(),
        );
    }
    app.opener()
        .open_path(target.to_string_lossy(), None::<&str>)
        .map_err(|error| AppError::Other(format!("Failed to open server path: {}", error)))?;
    Ok(())
}

#[tauri::command]
pub async fn import_custom_server_world(
    custom_server: CustomServer,
    source_path: String,
) -> Result<(), CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    let source = PathBuf::from(source_path);
    if !source.is_dir() {
        return Err(AppError::Other("Selected world path is not a folder".to_string()).into());
    }

    let target = server_dir.join("world");
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        if target.exists() {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs())
                .unwrap_or(0);
            let backup = target.with_file_name(format!("world.backup-{}", timestamp));
            fs::rename(&target, backup)?;
        }

        copy_dir_all_sync(&source, &target)?;
        Ok(())
    })
    .await
    .map_err(|error| AppError::Other(format!("World import task failed: {}", error)))??;

    Ok(())
}

#[tauri::command]
pub async fn import_custom_server_world_from_profile(
    custom_server: CustomServer,
    profile_id: Uuid,
    world_folder: String,
) -> Result<(), CommandError> {
    if world_folder.is_empty() || world_folder.contains('/') || world_folder.contains('\\') {
        return Err(AppError::InvalidInput("Invalid world folder".to_string()).into());
    }

    let state = State::get().await?;
    let profile = match state.profile_manager.get_profile(profile_id).await {
        Ok(profile) => profile,
        Err(AppError::ProfileNotFound(_)) => state
            .norisk_version_manager
            .get_profile_by_id(profile_id)
            .await
            .ok_or(AppError::ProfileNotFound(profile_id))?,
        Err(error) => return Err(error.into()),
    };
    let instance_path = state
        .profile_manager
        .calculate_instance_path_for_profile(&profile)?;
    let source = instance_path.join("saves").join(world_folder);
    import_custom_server_world(custom_server, source.to_string_lossy().to_string()).await
}

#[tauri::command]
pub async fn backup_custom_server_world(
    custom_server: CustomServer,
    world_folder: String,
) -> Result<String, CommandError> {
    if world_folder.is_empty() || world_folder.contains('/') || world_folder.contains('\\') {
        return Err(AppError::InvalidInput("Invalid world folder".to_string()).into());
    }

    let server_dir = custom_server_dir(&custom_server)?;
    let source = server_dir.join(&world_folder);
    if !source.is_dir() {
        return Err(AppError::Other("World folder does not exist".to_string()).into());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let target = server_dir.join(format!("{}.backup-{}", world_folder, timestamp));

    tokio::task::spawn_blocking({
        let source = source.clone();
        let target = target.clone();
        move || copy_dir_all_sync(&source, &target)
    })
    .await
    .map_err(|error| AppError::Other(format!("World backup task failed: {}", error)))??;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_custom_server_files(
    custom_server: CustomServer,
) -> Result<Vec<ServerFileTreeEntry>, CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;
    tokio::task::spawn_blocking(move || list_dir_entries(&server_dir, &server_dir, 0))
        .await
        .map_err(|error| AppError::Other(format!("File tree task failed: {}", error)))?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn list_custom_server_worlds(
    custom_server: CustomServer,
) -> Result<Vec<CustomServerWorldInfo>, CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;

    let mut worlds = Vec::new();
    let mut entries = tokio::fs::read_dir(&server_dir)
        .await
        .map_err(AppError::from)?;
    while let Some(entry) = entries.next_entry().await.map_err(AppError::from)? {
        let path = entry.path();
        if !path.is_dir() || !path.join("level.dat").is_file() {
            continue;
        }

        let folder_name = entry.file_name().to_string_lossy().to_string();
        let size_bytes = calculate_dir_size_recursively(&path).await.unwrap_or(0);
        let metadata = read_server_world_metadata(&path).await;
        let display_name = metadata
            .as_ref()
            .and_then(|data| data.data.level_name.clone())
            .unwrap_or_else(|| folder_name.clone());
        let game_day = metadata
            .as_ref()
            .and_then(|data| data.data.day_time.or(data.data.time))
            .map(|ticks| ticks / 24000);
        let last_played = metadata.as_ref().and_then(|data| data.data.last_played);
        let version_name = metadata
            .as_ref()
            .and_then(|data| data.data.version.as_ref())
            .and_then(|version| version.name.clone());

        worlds.push(CustomServerWorldInfo {
            folder_name,
            display_name,
            path: path.to_string_lossy().to_string(),
            size_bytes,
            game_day,
            last_played,
            version_name,
        });
    }

    worlds.sort_by(|a, b| b.last_played.cmp(&a.last_played));
    Ok(worlds)
}

#[tauri::command]
pub async fn get_custom_server_properties(
    custom_server: CustomServer,
) -> Result<CustomServerProperties, CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    let properties_path = server_dir.join("server.properties");
    if !properties_path.exists() {
        return Ok(default_custom_server_properties(&custom_server));
    }

    let properties = tokio::fs::read_to_string(properties_path)
        .await
        .map_err(AppError::from)?;
    Ok(parse_custom_server_properties(
        &properties,
        &default_custom_server_properties(&custom_server),
    ))
}

#[tauri::command]
pub async fn update_custom_server_properties(
    custom_server: CustomServer,
    properties: CustomServerProperties,
) -> Result<(), CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;

    let properties_path = server_dir.join("server.properties");
    let mut content = if properties_path.exists() {
        tokio::fs::read_to_string(&properties_path)
            .await
            .map_err(AppError::from)?
    } else {
        String::new()
    };

    upsert_property(&mut content, "motd", &properties.motd.replace('\n', " "));
    upsert_property(
        &mut content,
        "max-players",
        &properties.max_players.to_string(),
    );
    upsert_property(&mut content, "difficulty", &properties.difficulty);
    upsert_property(&mut content, "gamemode", &properties.gamemode);
    upsert_property(
        &mut content,
        "online-mode",
        bool_property(properties.online_mode),
    );
    upsert_property(&mut content, "pvp", bool_property(properties.pvp));
    upsert_property(
        &mut content,
        "allow-flight",
        bool_property(properties.allow_flight),
    );
    upsert_property(
        &mut content,
        "view-distance",
        &properties.view_distance.to_string(),
    );
    upsert_property(
        &mut content,
        "simulation-distance",
        &properties.simulation_distance.to_string(),
    );
    upsert_property(
        &mut content,
        "spawn-protection",
        &properties.spawn_protection.to_string(),
    );

    tokio::fs::write(properties_path, content)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn list_installed_server_addons(
    custom_server: CustomServer,
) -> Result<Vec<InstalledServerAddon>, CommandError> {
    let mods_dir = custom_server_dir(&custom_server)?.join("mods");
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    let mut addons = Vec::new();
    let mut entries = tokio::fs::read_dir(mods_dir)
        .await
        .map_err(AppError::from)?;
    while let Some(entry) = entries.next_entry().await.map_err(AppError::from)? {
        let path = entry.path();
        let is_jar = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jar"));
        if !is_jar {
            continue;
        }

        let metadata = entry.metadata().await.map_err(AppError::from)?;
        addons.push(InstalledServerAddon {
            file_name: entry.file_name().to_string_lossy().to_string(),
            size_bytes: metadata.len(),
        });
    }

    addons.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(addons)
}

#[tauri::command]
pub async fn install_modrinth_server_addon(
    app: AppHandle,
    custom_server: CustomServer,
    file_name: String,
    download_url: String,
) -> Result<(), CommandError> {
    let mods_dir = custom_server_dir(&custom_server)?.join("mods");
    tokio::fs::create_dir_all(&mods_dir)
        .await
        .map_err(AppError::from)?;

    let safe_file_name = sanitize_filename::sanitize(file_name);
    if !safe_file_name.ends_with(".jar") {
        return Err(
            AppError::InvalidInput("Only .jar server addons are supported".to_string()).into(),
        );
    }

    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!("[INFO] Installing server addon {}", safe_file_name),
    );

    let bytes = HTTP_CLIENT
        .get(download_url)
        .send()
        .await
        .map_err(AppError::from)?
        .error_for_status()
        .map_err(AppError::from)?
        .bytes()
        .await
        .map_err(AppError::from)?;

    tokio::fs::write(mods_dir.join(&safe_file_name), bytes)
        .await
        .map_err(AppError::from)?;

    emit_custom_server_log(
        &app,
        &custom_server.id,
        &format!("[INFO] Installed server addon {}", safe_file_name),
    );

    Ok(())
}

#[tauri::command]
pub async fn export_custom_server(
    custom_server: CustomServer,
    target_path: String,
) -> Result<String, CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    if !server_dir.exists() {
        return Err(AppError::Other("Server folder does not exist yet".to_string()).into());
    }

    let target = PathBuf::from(target_path);
    let manifest = CustomServerArchiveManifest {
        name: custom_server.name.clone(),
        mc_version: custom_server.mc_version.clone(),
        loader_version: custom_server.loader_version.clone(),
        r#type: custom_server.r#type.clone(),
        exported_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0),
    };

    tokio::task::spawn_blocking({
        let server_dir = server_dir.clone();
        let target = target.clone();
        move || export_server_zip_sync(&server_dir, &target, &manifest)
    })
    .await
    .map_err(|error| AppError::Other(format!("Server export task failed: {}", error)))??;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn analyze_custom_server_import(
    source_path: String,
) -> Result<CustomServerImportPreview, CommandError> {
    let source = PathBuf::from(source_path);
    let preview = tokio::task::spawn_blocking(move || analyze_server_import_sync(&source))
        .await
        .map_err(|error| AppError::Other(format!("Server import analysis failed: {}", error)))??;
    Ok(preview)
}

#[tauri::command]
pub async fn import_custom_server_files(
    custom_server: CustomServer,
    source_path: String,
) -> Result<(), CommandError> {
    let server_dir = custom_server_dir(&custom_server)?;
    tokio::fs::create_dir_all(&server_dir)
        .await
        .map_err(AppError::from)?;

    let source = PathBuf::from(source_path);
    tokio::task::spawn_blocking(move || import_server_files_sync(&source, &server_dir))
        .await
        .map_err(|error| AppError::Other(format!("Server import task failed: {}", error)))??;

    Ok(())
}

fn custom_server_dir(custom_server: &CustomServer) -> Result<PathBuf, CommandError> {
    let folder =
        sanitize_filename::sanitize(format!("{}-{}", custom_server.subdomain, custom_server.id));
    let root_dir = LAUNCHER_DIRECTORY.root_dir();
    let new_base_dir = root_dir.join("data").join("custom-servers");
    let new_dir = new_base_dir.join(&folder);
    let old_dir = root_dir.join("custom-servers").join(folder);

    if !new_dir.exists() && old_dir.exists() {
        fs::create_dir_all(&new_base_dir).map_err(AppError::from)?;
        fs::rename(&old_dir, &new_dir).map_err(AppError::from)?;
    }

    Ok(new_dir)
}

fn copy_dir_all_sync(source: &PathBuf, target: &PathBuf) -> Result<(), AppError> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let next_source = entry.path();
        let next_target = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all_sync(&next_source, &next_target)?;
        } else if file_type.is_file() {
            fs::copy(&next_source, &next_target)?;
        }
    }
    Ok(())
}

fn export_server_zip_sync(
    server_dir: &Path,
    target_path: &Path,
    manifest: &CustomServerArchiveManifest,
) -> Result<(), AppError> {
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = fs::File::create(target_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file("fullrisk-server.json", options)
        .map_err(|error| {
            AppError::Other(format!(
                "Failed to write server archive manifest: {}",
                error
            ))
        })?;
    let manifest_json = serde_json::to_vec_pretty(manifest).map_err(|error| {
        AppError::Other(format!(
            "Failed to serialize server archive manifest: {}",
            error
        ))
    })?;
    zip.write_all(&manifest_json)?;

    add_dir_to_zip(&mut zip, server_dir, server_dir, options)?;
    zip.finish()
        .map_err(|error| AppError::Other(format!("Failed to finish server archive: {}", error)))?;
    Ok(())
}

fn add_dir_to_zip(
    zip: &mut ZipWriter<fs::File>,
    root: &Path,
    dir: &Path,
    options: SimpleFileOptions,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|error| {
                AppError::Other(format!("Failed to calculate archive path: {}", error))
            })?
            .to_string_lossy()
            .replace('\\', "/");
        let archive_name = format!("server/{}", relative);

        if path.is_dir() {
            zip.add_directory(format!("{}/", archive_name), options)
                .map_err(|error| {
                    AppError::Other(format!("Failed to add archive folder: {}", error))
                })?;
            add_dir_to_zip(zip, root, &path, options)?;
        } else if path.is_file() {
            zip.start_file(archive_name, options).map_err(|error| {
                AppError::Other(format!("Failed to add archive file: {}", error))
            })?;
            let mut file = fs::File::open(&path)?;
            std::io::copy(&mut file, zip)?;
        }
    }
    Ok(())
}

fn analyze_server_import_sync(source: &Path) -> Result<CustomServerImportPreview, AppError> {
    if source.is_dir() {
        return analyze_server_folder_sync(source, None);
    }

    let file = fs::File::open(source)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| AppError::Other(format!("Failed to read server archive: {}", error)))?;
    let manifest = read_server_archive_manifest(&mut archive)?;
    let mut addon_count = 0;
    let mut world_folders: Vec<String> = Vec::new();
    let mut size_bytes = 0;

    for index in 0..archive.len() {
        let file = archive
            .by_index(index)
            .map_err(|error| AppError::Other(format!("Failed to read archive entry: {}", error)))?;
        let name = file.name().replace('\\', "/");
        if file.is_dir() || !name.starts_with("server/") {
            continue;
        }
        size_bytes += file.size();
        if name.starts_with("server/mods/") && name.to_lowercase().ends_with(".jar") {
            addon_count += 1;
        }
        if let Some(world_name) = name
            .strip_prefix("server/")
            .and_then(|relative| relative.strip_suffix("/level.dat"))
            .filter(|relative| !relative.contains('/'))
        {
            world_folders.push(world_name.to_string());
        }
    }

    let fallback_name = source
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported Server")
        .to_string();
    Ok(CustomServerImportPreview {
        name: manifest
            .as_ref()
            .map(|manifest| manifest.name.clone())
            .unwrap_or(fallback_name),
        mc_version: manifest
            .as_ref()
            .map(|manifest| manifest.mc_version.clone())
            .unwrap_or_else(|| "1.21.5".to_string()),
        loader_version: manifest
            .as_ref()
            .and_then(|manifest| manifest.loader_version.clone()),
        r#type: manifest
            .as_ref()
            .map(|manifest| manifest.r#type.clone())
            .unwrap_or(CustomServerType::Vanilla),
        addon_count,
        world_count: world_folders.len(),
        size_bytes,
    })
}

fn read_server_archive_manifest(
    archive: &mut ZipArchive<fs::File>,
) -> Result<Option<CustomServerArchiveManifest>, AppError> {
    let Ok(mut manifest_file) = archive.by_name("fullrisk-server.json") else {
        return Ok(None);
    };
    let mut content = String::new();
    manifest_file.read_to_string(&mut content)?;
    serde_json::from_str::<CustomServerArchiveManifest>(&content)
        .map(Some)
        .map_err(|error| {
            AppError::Other(format!(
                "Failed to parse server archive manifest: {}",
                error
            ))
        })
}

fn analyze_server_folder_sync(
    source: &Path,
    manifest: Option<CustomServerArchiveManifest>,
) -> Result<CustomServerImportPreview, AppError> {
    let properties = fs::read_to_string(source.join("server.properties")).unwrap_or_default();
    let properties = parse_properties(&properties);
    let addon_count = count_jars_sync(&source.join("mods"))?;
    let world_count = count_worlds_sync(source)?;
    let size_bytes = calculate_dir_size_sync(source)?;
    let inferred_type = manifest
        .as_ref()
        .map(|manifest| manifest.r#type.clone())
        .unwrap_or_else(|| infer_server_type_from_folder(source, addon_count));
    let inferred_version = manifest
        .as_ref()
        .map(|manifest| manifest.mc_version.clone())
        .or_else(|| infer_mc_version_from_folder(source))
        .unwrap_or_else(|| "1.21.5".to_string());

    Ok(CustomServerImportPreview {
        name: manifest
            .as_ref()
            .map(|manifest| manifest.name.clone())
            .or_else(|| properties.get("motd").cloned())
            .or_else(|| {
                source
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "Imported Server".to_string()),
        mc_version: inferred_version,
        loader_version: manifest.and_then(|manifest| manifest.loader_version),
        r#type: inferred_type,
        addon_count,
        world_count,
        size_bytes,
    })
}

fn import_server_files_sync(source: &Path, target: &Path) -> Result<(), AppError> {
    if source.is_dir() {
        copy_dir_all_sync(&source.to_path_buf(), &target.to_path_buf())?;
        return Ok(());
    }

    let file = fs::File::open(source)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| AppError::Other(format!("Failed to read server archive: {}", error)))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| AppError::Other(format!("Failed to read archive entry: {}", error)))?;
        let Some(enclosed_name) = entry.enclosed_name().map(|path| path.to_path_buf()) else {
            continue;
        };
        let Ok(relative) = enclosed_name.strip_prefix("server") else {
            continue;
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let output_path = target.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&output_path)?;
        } else {
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut output = fs::File::create(&output_path)?;
            std::io::copy(&mut entry, &mut output)?;
        }
    }

    Ok(())
}

fn count_jars_sync(dir: &Path) -> Result<usize, AppError> {
    if !dir.is_dir() {
        return Ok(0);
    }
    let mut count = 0;
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jar"))
        {
            count += 1;
        }
    }
    Ok(count)
}

fn count_worlds_sync(server_dir: &Path) -> Result<usize, AppError> {
    let mut count = 0;
    for entry in fs::read_dir(server_dir)? {
        let path = entry?.path();
        if path.is_dir() && path.join("level.dat").is_file() {
            count += 1;
        }
    }
    Ok(count)
}

fn calculate_dir_size_sync(dir: &Path) -> Result<u64, AppError> {
    let mut size = 0;
    if !dir.is_dir() {
        return Ok(size);
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            size += calculate_dir_size_sync(&path)?;
        } else if metadata.is_file() {
            size += metadata.len();
        }
    }
    Ok(size)
}

fn infer_server_type_from_folder(source: &Path, addon_count: usize) -> CustomServerType {
    let mut candidates = Vec::new();
    if let Ok(entries) = fs::read_dir(source) {
        for entry in entries.flatten() {
            candidates.push(entry.file_name().to_string_lossy().to_lowercase());
        }
    }
    let joined = candidates.join(" ");
    if joined.contains("neoforge") {
        CustomServerType::NeoForge
    } else if joined.contains("forge") {
        CustomServerType::Forge
    } else if joined.contains("fabric") {
        CustomServerType::Fabric
    } else if joined.contains("quilt") {
        CustomServerType::Quilt
    } else if joined.contains("paper") {
        CustomServerType::Paper
    } else if joined.contains("purpur") {
        CustomServerType::Purpur
    } else if joined.contains("spigot") {
        CustomServerType::Spigot
    } else if joined.contains("bukkit") {
        CustomServerType::Bukkit
    } else if joined.contains("folia") {
        CustomServerType::Folia
    } else if addon_count > 0 {
        CustomServerType::Fabric
    } else {
        CustomServerType::Vanilla
    }
}

fn infer_mc_version_from_folder(source: &Path) -> Option<String> {
    let entries = fs::read_dir(source).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(version) = find_mc_version_in_text(&name) {
            return Some(version);
        }
    }
    None
}

fn find_mc_version_in_text(text: &str) -> Option<String> {
    let re = regex::Regex::new(r"1\.\d+(?:\.\d+)?").ok()?;
    re.find(text).map(|item| item.as_str().to_string())
}

fn list_dir_entries(
    root: &Path,
    dir: &Path,
    depth: usize,
) -> Result<Vec<ServerFileTreeEntry>, AppError> {
    if depth > 6 {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = entry.metadata()?;
        let is_dir = metadata.is_dir();
        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let children = if is_dir {
            list_dir_entries(root, &path, depth + 1)?
        } else {
            Vec::new()
        };
        let size_bytes = if is_dir {
            children.iter().map(|child| child.size_bytes).sum()
        } else {
            metadata.len()
        };

        entries.push(ServerFileTreeEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            relative_path,
            is_dir,
            size_bytes,
            children,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

async fn read_server_world_metadata(path: &Path) -> Option<ServerLevelDat> {
    let file = tokio::fs::File::open(path.join("level.dat")).await.ok()?;
    let mut decoder = GzipDecoder::new(BufReader::new(file));
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).await.ok()?;
    from_bytes::<ServerLevelDat>(&decompressed).ok()
}

fn default_custom_server_properties(custom_server: &CustomServer) -> CustomServerProperties {
    CustomServerProperties {
        motd: custom_server.name.clone(),
        max_players: 20,
        difficulty: "easy".to_string(),
        gamemode: "survival".to_string(),
        online_mode: true,
        pvp: true,
        allow_flight: false,
        view_distance: 10,
        simulation_distance: 10,
        spawn_protection: 16,
    }
}

fn parse_custom_server_properties(
    content: &str,
    default: &CustomServerProperties,
) -> CustomServerProperties {
    let map = parse_properties(content);
    CustomServerProperties {
        motd: map
            .get("motd")
            .cloned()
            .unwrap_or_else(|| default.motd.clone()),
        max_players: parse_u32_property(&map, "max-players", default.max_players),
        difficulty: map
            .get("difficulty")
            .cloned()
            .unwrap_or_else(|| default.difficulty.clone()),
        gamemode: map
            .get("gamemode")
            .cloned()
            .unwrap_or_else(|| default.gamemode.clone()),
        online_mode: parse_bool_property(&map, "online-mode", default.online_mode),
        pvp: parse_bool_property(&map, "pvp", default.pvp),
        allow_flight: parse_bool_property(&map, "allow-flight", default.allow_flight),
        view_distance: parse_u32_property(&map, "view-distance", default.view_distance),
        simulation_distance: parse_u32_property(
            &map,
            "simulation-distance",
            default.simulation_distance,
        ),
        spawn_protection: parse_u32_property(&map, "spawn-protection", default.spawn_protection),
    }
}

fn parse_properties(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=') {
            map.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    map
}

fn parse_u32_property(map: &HashMap<String, String>, key: &str, fallback: u32) -> u32 {
    map.get(key)
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(fallback)
}

fn parse_bool_property(map: &HashMap<String, String>, key: &str, fallback: bool) -> bool {
    map.get(key)
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(fallback)
}

fn bool_property(value: bool) -> &'static str {
    if value {
        "true"
    } else {
        "false"
    }
}

async fn prepare_server_files(
    custom_server: &CustomServer,
    server_dir: &PathBuf,
) -> Result<(), AppError> {
    let eula_path = server_dir.join("eula.txt");
    if !eula_path.exists() {
        tokio::fs::write(&eula_path, "eula=true\n").await?;
    }

    let properties_path = server_dir.join("server.properties");
    let mut properties = if properties_path.exists() {
        tokio::fs::read_to_string(&properties_path).await?
    } else {
        String::new()
    };

    upsert_property(&mut properties, "server-ip", "");
    upsert_property(
        &mut properties,
        "server-port",
        &custom_server.port.unwrap_or(25565).to_string(),
    );
    upsert_property(
        &mut properties,
        "motd",
        &custom_server.name.replace('\n', " "),
    );
    upsert_property(&mut properties, "enable-rcon", "false");
    upsert_property(
        &mut properties,
        "rcon.port",
        &custom_server
            .port
            .unwrap_or(25565)
            .saturating_add(1000)
            .to_string(),
    );
    upsert_property(&mut properties, "rcon.password", "minecraft");
    upsert_property(&mut properties, "broadcast-rcon-to-ops", "false");

    tokio::fs::write(&properties_path, properties).await?;

    Ok(())
}

fn upsert_property(properties: &mut String, key: &str, value: &str) {
    let mut found = false;
    let mut lines = Vec::new();

    for line in properties.lines() {
        if line.starts_with('#') || !line.contains('=') {
            lines.push(line.to_string());
            continue;
        }

        let Some((current_key, _)) = line.split_once('=') else {
            lines.push(line.to_string());
            continue;
        };

        if current_key == key {
            lines.push(format!("{}={}", key, value));
            found = true;
        } else {
            lines.push(line.to_string());
        }
    }

    if !found {
        lines.push(format!("{}={}", key, value));
    }

    *properties = format!("{}\n", lines.join("\n"));
}

async fn ensure_vanilla_server_jar(
    app: &AppHandle,
    custom_server: &CustomServer,
    server_dir: &PathBuf,
) -> Result<(PathBuf, u32), AppError> {
    let jar_path = server_dir.join(format!("minecraft-server-{}.jar", custom_server.mc_version));
    let manifest = HTTP_CLIENT
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await?
        .error_for_status()?
        .json::<VersionManifest>()
        .await?;

    let version = manifest
        .versions
        .into_iter()
        .find(|entry| entry.id == custom_server.mc_version)
        .ok_or_else(|| AppError::VersionNotFound(custom_server.mc_version.clone()))?;

    let metadata = HTTP_CLIENT
        .get(version.url)
        .send()
        .await?
        .error_for_status()?
        .json::<VersionMetadata>()
        .await?;
    let required_java_major = metadata
        .java_version
        .as_ref()
        .map(|java| java.major_version)
        .unwrap_or(21);

    if jar_path.exists() {
        return Ok((jar_path, required_java_major));
    }

    emit_custom_server_log(
        app,
        &custom_server.id,
        &format!(
            "[INFO] Downloading Minecraft server jar {}",
            custom_server.mc_version
        ),
    );

    let download = metadata.downloads.server.ok_or_else(|| {
        AppError::Download("This Minecraft version has no server jar".to_string())
    })?;

    let bytes = HTTP_CLIENT
        .get(download.url)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    tokio::fs::write(&jar_path, bytes).await?;
    Ok((jar_path, required_java_major))
}

async fn resolve_server_java(
    app: &AppHandle,
    server_id: &str,
    required_major: u32,
) -> Result<PathBuf, AppError> {
    let installations = detect_java_installations().await?;
    if let Some(java) = installations
        .into_iter()
        .filter(|java| java.major_version >= required_major)
        .max_by_key(|java| (java.major_version, java.is_64bit))
    {
        return Ok(normalize_server_java_binary(java.path));
    }

    emit_custom_server_log(
        app,
        server_id,
        &format!(
            "[INFO] Downloading Java {} for this Minecraft server",
            required_major
        ),
    );

    let service = JavaDownloadService::new();
    let java_path = service
        .get_or_download_java(required_major, &JavaDistribution::Temurin, None)
        .await?;
    Ok(normalize_server_java_binary(java_path))
}

fn normalize_server_java_binary(java_path: PathBuf) -> PathBuf {
    if cfg!(target_os = "windows") {
        if java_path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case("javaw.exe"))
        {
            let java_exe = java_path.with_file_name("java.exe");
            if java_exe.exists() {
                return java_exe;
            }
        }
    }

    java_path
}

fn pipe_process_output<R>(app: AppHandle, server_id: String, stream: R)
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(stream).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            emit_custom_server_log(&app, &server_id, &line);
        }
    });
}

fn emit_custom_server_log(app: &AppHandle, server_id: &str, data: &str) {
    let server_id_for_store = server_id.to_string();
    let data_for_store = data.to_string();
    tokio::spawn(async move {
        let mut logs = CUSTOM_SERVER_LOGS.lock().await;
        let server_logs = logs.entry(server_id_for_store).or_default();
        server_logs.push(data_for_store);
        if server_logs.len() > 5000 {
            let remove_count = server_logs.len() - 5000;
            server_logs.drain(0..remove_count);
        }
    });

    let _ = app.emit(
        "custom-server-process-output",
        CustomServerEventPayload {
            server_id: server_id.to_string(),
            data: data.to_string(),
        },
    );
}

impl CustomServer {
    fn type_name(&self) -> &'static str {
        match &self.r#type {
            CustomServerType::Vanilla => "VANILLA",
            CustomServerType::Forge => "FORGE",
            CustomServerType::Fabric => "FABRIC",
            CustomServerType::NeoForge => "NEO_FORGE",
            CustomServerType::Quilt => "QUILT",
            CustomServerType::Paper => "PAPER",
            CustomServerType::Spigot => "SPIGOT",
            CustomServerType::Bukkit => "BUKKIT",
            CustomServerType::Folia => "FOLIA",
            CustomServerType::Purpur => "PURPUR",
        }
    }
}
