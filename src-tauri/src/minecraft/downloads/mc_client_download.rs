use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::Result;
use crate::minecraft::dto::piston_meta::DownloadInfo;
use crate::utils::download_utils::{DownloadConfig, DownloadUtils};
use log::info;
use std::path::PathBuf;
use tokio::fs;

const VERSIONS_DIR: &str = "versions";

pub struct MinecraftClientDownloadService {
    base_path: PathBuf,
}

impl MinecraftClientDownloadService {
    pub fn new() -> Self {
        let base_path = LAUNCHER_DIRECTORY.meta_dir().join(VERSIONS_DIR);
        Self { base_path }
    }

    pub async fn download_client(
        &self,
        client_info: &DownloadInfo,
        version_id: &str,
    ) -> Result<()> {
        let version_dir = self.base_path.join(version_id);
        let target_path = version_dir.join(format!("{}.jar", version_id));

        fs::create_dir_all(&version_dir).await?;

        info!("Downloading client jar for version: {}", version_id);

        // Use the new centralized download utility with size verification
        let config = DownloadConfig::new()
            .with_size(client_info.size as u64)  // Size verification prevents corruption
            .with_streaming(true)  // Client JARs are large files
            .with_retries(3);  // Built-in retry logic for network issues

        DownloadUtils::download_file(&client_info.url, &target_path, config).await?;

        info!("Downloaded client jar to: {}", target_path.display());
        Ok(())
    }
}
