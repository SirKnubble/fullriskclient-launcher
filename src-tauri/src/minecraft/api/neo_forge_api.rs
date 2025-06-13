use crate::error::{AppError, Result};
use crate::minecraft::dto::neo_forge_maven_meta::NeoForgeMavenMetadata;
use log::info;
use quick_xml::de::from_str;
use reqwest;

const NEO_FORGE_MAVEN_METADATA_URL: &str =
    "https://maven.neoforged.net/net/neoforged/neoforge/maven-metadata.xml";

pub struct NeoForgeApi {
    base_url: String,
}

impl NeoForgeApi {
    pub fn new() -> Self {
        Self {
            base_url: NEO_FORGE_MAVEN_METADATA_URL.to_string(),
        }
    }

    pub async fn get_all_versions(&self) -> Result<NeoForgeMavenMetadata> {
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

        let metadata: NeoForgeMavenMetadata = from_str(&xml_content)
            .map_err(|e| AppError::ForgeError(format!("Failed to parse Forge metadata: {}", e)))?;

        info!(
            "Successfully fetched {} Forge versions",
            metadata.get_all_versions().len()
        );
        Ok(metadata)
    }
}
