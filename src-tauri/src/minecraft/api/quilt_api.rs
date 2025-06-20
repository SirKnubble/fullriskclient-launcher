use crate::config::HTTP_CLIENT;
use crate::error::Result;
use crate::minecraft::dto::quilt_meta::QuiltVersionInfo;
use reqwest;

pub struct QuiltApi {
    base_url: String,
}

impl QuiltApi {
    pub fn new() -> Self {
        Self {
            base_url: "https://meta.quiltmc.org/v3".to_string(),
        }
    }

    pub async fn get_loader_versions(
        &self,
        minecraft_version: &str,
    ) -> Result<Vec<QuiltVersionInfo>> {
        let url = format!("{}/versions/loader/{}", self.base_url, minecraft_version);

        let response = HTTP_CLIENT.get(&url).send().await.map_err(|e| {
            crate::error::AppError::QuiltError(format!("Failed to fetch Quilt versions: {}", e))
        })?;

        if !response.status().is_success() {
            return Err(crate::error::AppError::QuiltError(format!(
                "Failed to fetch Quilt versions: Status {}",
                response.status()
            )));
        }

        let versions = response
            .json::<Vec<QuiltVersionInfo>>()
            .await
            .map_err(|e| {
                crate::error::AppError::QuiltError(format!("Failed to parse Quilt versions: {}", e))
            })?;

        Ok(versions)
    }

    pub async fn get_latest_stable_version(
        &self,
        minecraft_version: &str,
    ) -> Result<QuiltVersionInfo> {
        let versions = self.get_loader_versions(minecraft_version).await?;

        versions
            .into_iter()
            .filter(|v| v.loader.stable)
            .max_by_key(|v| v.loader.build)
            .ok_or_else(|| {
                crate::error::AppError::QuiltError("No stable Quilt version found".to_string())
            })
    }
}
