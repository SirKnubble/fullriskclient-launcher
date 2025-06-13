use crate::error::{AppError, Result};
use crate::minecraft::dto::forge_maven_meta::ForgeMavenMetadata;
use log::info;
use quick_xml::de::from_str;
use reqwest;

const FORGE_MAVEN_METADATA_URL: &str =
    "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";

pub struct ForgeApi {
    base_url: String,
}

impl ForgeApi {
    pub fn new() -> Self {
        Self {
            base_url: FORGE_MAVEN_METADATA_URL.to_string(),
        }
    }

    pub async fn get_all_versions(&self) -> Result<ForgeMavenMetadata> {
        info!("Fetching Forge versions from Maven repository...");

        let response = reqwest::get(&self.base_url)
            .await
            .map_err(|e| AppError::ForgeError(format!("Failed to fetch Forge versions: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::ForgeError(format!(
                "Failed to fetch Forge versions: Status {}",
                response.status()
            )));
        }

        let xml_content = response
            .text()
            .await
            .map_err(|e| AppError::ForgeError(format!("Failed to read response: {}", e)))?;

        let metadata: ForgeMavenMetadata = from_str(&xml_content)
            .map_err(|e| AppError::ForgeError(format!("Failed to parse Forge metadata: {}", e)))?;

        info!(
            "Successfully fetched {} Forge versions",
            metadata.get_all_versions().len()
        );
        Ok(metadata)
    }
}
