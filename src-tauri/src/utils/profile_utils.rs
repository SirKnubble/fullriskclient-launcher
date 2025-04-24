use crate::error::{AppError, Result};
use crate::integrations::modrinth::{ModrinthProjectType, ModrinthVersion};
use crate::state::profile_state::Profile;
use crate::utils::{resourcepack_utils, shaderpack_utils, hash_utils};
use log::{debug, info, warn};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

/// Represents the type of content to be installed
pub enum ContentType {
    ResourcePack,
    ShaderPack,
    DataPack,
}

impl From<ModrinthProjectType> for ContentType {
    fn from(project_type: ModrinthProjectType) -> Self {
        match project_type {
            ModrinthProjectType::ResourcePack => ContentType::ResourcePack,
            ModrinthProjectType::Shader => ContentType::ShaderPack,
            ModrinthProjectType::Datapack => ContentType::DataPack,
            _ => panic!("Unsupported content type conversion"),
        }
    }
}

/// Adds Modrinth content (resourcepack, shaderpack, datapack) to a profile
pub async fn add_modrinth_content_to_profile(
    profile_id: Uuid,
    project_id: String,
    version_id: String,
    file_name: String,
    download_url: String,
    file_hash_sha1: Option<String>,
    content_name: Option<String>,
    version_number: Option<String>,
    content_type: ContentType,
) -> Result<()> {
    info!(
        "Adding Modrinth content to profile {}: {} ({})",
        profile_id,
        content_name.as_deref().unwrap_or(&file_name),
        content_type_to_string(&content_type)
    );

    // Get the profile
    let state = crate::state::state_manager::State::get().await?;
    let profile = state.profile_manager.get_profile(profile_id).await?;

    // Get the target directory based on content type
    let target_dir = get_content_directory(&profile, &content_type).await?;

    // Create the directory if it doesn't exist
    if !target_dir.exists() {
        debug!("Creating directory: {}", target_dir.display());
        fs::create_dir_all(&target_dir)
            .await
            .map_err(|e| AppError::Io(e))?;
    }

    // Construct the file path
    let file_path = target_dir.join(&file_name);
    debug!("Target file path: {}", file_path.display());

    // Download the file
    download_content(&download_url, &file_path, file_hash_sha1).await?;

    info!(
        "Successfully added {} '{}' to profile {}",
        content_type_to_string(&content_type),
        content_name.as_deref().unwrap_or(&file_name),
        profile_id
    );

    Ok(())
}

/// Helper function to download content from a URL
async fn download_content(
    url: &str,
    file_path: &Path,
    expected_sha1: Option<String>,
) -> Result<()> {
    info!(
        "Downloading content from {} to {}",
        url,
        file_path.display()
    );

    // Create a reqwest client
    let client = reqwest::Client::new();
    
    // Download the file
    let response = client
        .get(url)
        .header(
            "User-Agent",
            format!(
                "NoRiskClient-Launcher/{} (support@norisk.gg)",
                env!("CARGO_PKG_VERSION")
            ),
        )
        .send()
        .await
        .map_err(|e| AppError::Download(format!("Failed to download content: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Download(format!(
            "Failed to download content: HTTP {}",
            response.status()
        )));
    }

    // Get the bytes
    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::Download(format!("Failed to read content bytes: {}", e)))?;

    // Verify SHA1 hash if expected hash was provided
    if let Some(expected) = expected_sha1 {
        let hash = hash_utils::calculate_sha1_from_bytes(&bytes);
        
        if hash != expected {
            return Err(AppError::Download(format!(
                "SHA1 hash mismatch. Expected: {}, Got: {}",
                expected, hash
            )));
        }
        debug!("SHA1 hash verification successful");
    }

    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Io(e))?;
        }
    }

    // Write the file
    let mut file = fs::File::create(file_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    file.write_all(&bytes)
        .await
        .map_err(|e| AppError::Io(e))?;

    info!("Successfully downloaded content to {}", file_path.display());

    Ok(())
}

/// Helper function to get the correct directory for a specific content type
async fn get_content_directory(profile: &Profile, content_type: &ContentType) -> Result<PathBuf> {
    match content_type {
        ContentType::ResourcePack => resourcepack_utils::get_resourcepacks_dir(profile).await,
        ContentType::ShaderPack => shaderpack_utils::get_shaderpacks_dir(profile).await,
        ContentType::DataPack => get_datapacks_dir(profile).await,
    }
}

/// Helper function to get the datapacks directory for a profile
async fn get_datapacks_dir(profile: &Profile) -> Result<PathBuf> {
    let state = crate::state::state_manager::State::get().await?;
    let base_profiles_dir = state
        .profile_manager
        .calculate_instance_path_for_profile(profile)?;
    let datapacks_dir = base_profiles_dir.join("saves").join("datapacks");
    debug!(
        "Datapacks directory for profile {}: {}",
        profile.id,
        datapacks_dir.display()
    );
    Ok(datapacks_dir)
}

/// Converts ContentType to a string representation
fn content_type_to_string(content_type: &ContentType) -> &'static str {
    match content_type {
        ContentType::ResourcePack => "Resource Pack",
        ContentType::ShaderPack => "Shader Pack",
        ContentType::DataPack => "Data Pack",
    }
}

/// Helper function to install a Modrinth content pack from a ModrinthVersion
pub async fn install_modrinth_content(
    profile_id: Uuid,
    version: &ModrinthVersion,
    content_type: ContentType,
) -> Result<()> {
    // Find the primary file
    let primary_file = version.files.iter().find(|f| f.primary).ok_or_else(|| {
        AppError::ModrinthPrimaryFileNotFound {
            version_id: version.id.clone(),
        }
    })?;

    // Get SHA1 hash if available
    let sha1_hash = primary_file.hashes.sha1.clone();

    // Add the content to the profile
    add_modrinth_content_to_profile(
        profile_id,
        version.project_id.clone(),
        version.id.clone(),
        primary_file.filename.clone(),
        primary_file.url.clone(),
        sha1_hash,
        Some(version.name.clone()),
        Some(version.version_number.clone()),
        content_type,
    )
    .await?;

    Ok(())
}
