use thiserror::Error;
use serde::Serialize;
use std::io;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Minecraft API error: {0}")]
    MinecraftApi(#[from] reqwest::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Download error: {0}")]
    Download(String),
    
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Task error: {0}")]
    Task(#[from] tokio::task::JoinError),
    
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    
    #[error("Profile error: {0}")]
    Profile(String),
    
    #[error("Java download error: {0}")]
    JavaDownload(String),
    
    #[error("Version not found: {0}")]
    VersionNotFound(String),
    
    #[error("Fabric error: {0}")]
    FabricError(String),
    
    #[error("Quilt error: {0}")]
    QuiltError(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
    
    #[error("Library not found: {0}")]
    LibraryNotFound(String),
    
    #[error("Forge error: {0}")]
    ForgeError(String),

    #[error("NeoForge error: {0}")]
    NeoForgeError(String),
    
    #[error("Profile not found: {0}")]
    ProfileNotFound(Uuid),
    
    #[error("Mod with ID '{mod_id}' not found in profile '{profile_id}'")]
    ModNotFoundInProfile { profile_id: Uuid, mod_id: Uuid },
    
    #[error("Other error: {0}")]
    Other(String),
    
    #[error("Event state was not properly initialized")]
    EventStateNotInitialized,

    #[error("Tauri error: {0}")]
    TauriError(#[from] tauri::Error),

    #[error("Process error: {0}")]
    ProcessError(String),
    
    #[error("Account error: {0}")]
    AccountError(String),
    
    #[error("Event error: {0}")]
    EventError(String),

    #[error("Minecraft authentication error: {0}")]
    MinecraftAuthenticationError(
        #[from] crate::minecraft::minecraft_auth::MinecraftAuthenticationError,
    ),

    #[error("User is not logged in, no credentials available!")]
    NoCredentialsError,

    #[error("Profile '{profile_id}' cannot update mod '{mod_id}': Missing required dependency project ID '{missing_project_id}'. Please add this mod first.")]
    MissingModDependency {
        profile_id: Uuid,
        mod_id: Uuid,
        missing_project_id: String,
    },

    #[error("Could not find primary file for Modrinth version '{version_id}'")]
    ModrinthPrimaryFileNotFound { version_id: String },

    #[error("Invalid Mod Loader: {0}")]
    InvalidModLoader(String),

    #[error("Norisk Pack not found: {0}")]
    NoriskPackNotFound(String),

    #[error("Failed to resolve mod: {0}")]
    ModResolutionFailed(String),

    #[error("Process spawn failed: {0}")]
    ProcessSpawnFailed(String),

    #[error("Process not found: {0}")]
    ProcessNotFound(Uuid),

    #[error("Process kill failed: {0}")]
    ProcessKillFailed(u32),
    
    #[error("Modrinth hash not found: {0}")]
    ModrinthHashNotFound(String),

    #[error("Mrpack error: {0}")]
    MrpackError(String),

    #[error("Unsupported OS: {0}")]
    UnsupportedOS(String),

    #[error("Unsupported architecture: {0}")]
    UnsupportedArchitecture(String),

    #[error("Failed to upload log to mclo.gs: {0}")]
    MclogsUploadFailed(String),
}

#[derive(Serialize)]
pub struct CommandError {
    pub message: String,
    pub kind: String,
}

impl From<AppError> for CommandError {
    fn from(error: AppError) -> Self {
        CommandError {
            message: error.to_string(),
            kind: format!("{:?}", error),
        }
    }
}

pub type Result<T> = std::result::Result<T, AppError>;