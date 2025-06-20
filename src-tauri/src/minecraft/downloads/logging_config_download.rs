use crate::config::{ProjectDirsExt, HTTP_CLIENT, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::dto::piston_meta::LoggingClient;
use log::{error, info};
use reqwest;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;

const LOGGING_DIR: &str = "assets/log_configs";

pub struct MinecraftLoggingDownloadService {
    logging_configs_path: PathBuf,
}

impl MinecraftLoggingDownloadService {
    pub fn new() -> Self {
        let logging_configs_path = LAUNCHER_DIRECTORY.meta_dir().join(LOGGING_DIR);
        info!(
            "[Logging Config Service] Initialized. Config Path: {}",
            logging_configs_path.display()
        );
        Self {
            logging_configs_path,
        }
    }

    pub async fn download_logging_config(&self, logging: &LoggingClient) -> Result<PathBuf> {
        let file_name = logging.file.id.clone();
        let target_path = self.logging_configs_path.join(&file_name);

        // Check if file exists with correct size
        if fs::try_exists(&target_path).await? {
            if let Ok(metadata) = fs::metadata(&target_path).await {
                if metadata.len() as i64 == logging.file.size {
                    info!("[Logging Config Download] Config file {} already exists with correct size.", file_name);
                    return Ok(target_path);
                }
                info!("[Logging Config Download] Config file {} exists but size mismatch, redownloading.", file_name);
            }
        }

        info!(
            "[Logging Config Download] Downloading logging config: {}",
            file_name
        );
        let response = HTTP_CLIENT.get(&logging.file.url).send().await.map_err(|e| {
            error!("[Logging Config Download] Request error: {}", e);
            AppError::Download(format!("Failed to download logging configuration: {}", e))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "No error details available".to_string());

            error!(
                "[Logging Config Download] Failed with status {}: {}",
                status, error_text
            );
            return Err(AppError::Download(format!(
                "Failed to download logging config - Status {}: {}",
                status, error_text
            )));
        }

        let bytes = response.bytes().await.map_err(|e| {
            error!("[Logging Config Download] Failed to read bytes: {}", e);
            AppError::Download(format!("Failed to read logging config data: {}", e))
        })?;

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let mut file = fs::File::create(&target_path).await?;
        file.write_all(&bytes).await?;

        info!(
            "[Logging Config Download] Successfully downloaded logging config to: {}",
            target_path.display()
        );
        Ok(target_path)
    }

    pub fn get_jvm_argument(&self, logging_config_path: &PathBuf) -> String {
        format!(
            "-Dlog4j.configurationFile={}",
            logging_config_path.to_string_lossy()
        )
    }
}
