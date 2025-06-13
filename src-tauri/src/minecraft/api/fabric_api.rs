use crate::error::Result;
use crate::minecraft::dto::fabric_meta::FabricVersionInfo;
use reqwest;
pub struct FabricApi {
    base_url: String,
}

impl FabricApi {
    pub fn new() -> Self {
        Self {
            base_url: "https://meta.fabricmc.net/v2".to_string(),
        }
    }

    pub async fn get_loader_versions(
        &self,
        minecraft_version: &str,
    ) -> Result<Vec<FabricVersionInfo>> {
        let url = format!("{}/versions/loader/{}", self.base_url, minecraft_version);

        let response = reqwest::get(&url).await.map_err(|e| {
            crate::error::AppError::FabricError(format!("Failed to fetch Fabric versions: {}", e))
        })?;

        if !response.status().is_success() {
            return Err(crate::error::AppError::FabricError(format!(
                "Failed to fetch Fabric versions: Status {}",
                response.status()
            )));
        }

        let versions = response
            .json::<Vec<FabricVersionInfo>>()
            .await
            .map_err(|e| {
                crate::error::AppError::FabricError(format!(
                    "Failed to parse Fabric versions: {}",
                    e
                ))
            })?;

        Ok(versions)
    }

    pub async fn get_latest_stable_version(
        &self,
        minecraft_version: &str,
    ) -> Result<FabricVersionInfo> {
        let versions = self.get_loader_versions(minecraft_version).await?;

        versions
            .into_iter()
            .filter(|v| v.loader.stable)
            .max_by_key(|v| v.loader.build)
            .ok_or_else(|| {
                crate::error::AppError::FabricError("No stable Fabric version found".to_string())
            })
    }
}
