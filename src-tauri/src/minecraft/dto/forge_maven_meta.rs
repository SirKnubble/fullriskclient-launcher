use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ForgeMavenMetadata {
    #[serde(rename = "versioning")]
    pub versioning: Versioning,
}

#[derive(Debug, Deserialize)]
pub struct Versioning {
    #[serde(rename = "latest")]
    pub latest: String,
    #[serde(rename = "release")]
    pub release: String,
    #[serde(rename = "versions")]
    pub versions: Versions,
}

#[derive(Debug, Deserialize)]
pub struct Versions {
    #[serde(rename = "version")]
    pub versions: Vec<String>,
}

impl ForgeMavenMetadata {
    pub fn get_latest_version(&self) -> &str {
        &self.versioning.latest
    }

    pub fn get_release_version(&self) -> &str {
        &self.versioning.release
    }

    pub fn get_all_versions(&self) -> &[String] {
        &self.versioning.versions.versions
    }

    pub fn get_versions_for_minecraft(&self, minecraft_version: &str) -> Vec<String> {
        self.versioning
            .versions
            .versions
            .iter()
            .filter(|v| v.starts_with(minecraft_version))
            .cloned()
            .collect()
    }

    pub fn get_latest_version_for_minecraft(&self, minecraft_version: &str) -> Option<String> {
        self.get_versions_for_minecraft(minecraft_version)
            .into_iter()
            .next()
    }
}
