use crate::config::HTTP_CLIENT;
use crate::error::{AppError, Result};
use log::{self, error, info};
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;

// Base URL for CurseForge API
const CURSEFORGE_API_BASE_URL: &str = "https://api.curseforge.com/v1";

// Public CurseForge API Key (from PrismLauncher/MultiMC)
const CURSEFORGE_API_KEY: &str = "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm";

// Structures for deserializing CurseForge API responses (Search)
// Based on https://docs.curseforge.com/rest-api/?javascript#tocS_Search%20Mods%20Response

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeSearchResponse {
    pub data: Vec<CurseForgeMod>,
    pub pagination: CurseForgePagination,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgePagination {
    pub index: u32,
    pub pageSize: u32,
    pub resultCount: u32,
    pub totalCount: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeMod {
    pub id: u32,
    pub gameId: u32,
    pub name: String,
    pub slug: String,
    pub links: CurseForgeLinks,
    pub summary: String,
    pub status: u32,
    pub downloadCount: u64,
    pub isFeatured: bool,
    pub primaryCategoryId: u32,
    pub categories: Vec<CurseForgeCategory>,
    pub classId: Option<u32>,
    pub authors: Vec<CurseForgeAuthor>,
    pub logo: Option<CurseForgeAttachment>,
    pub screenshots: Vec<CurseForgeAttachment>,
    pub mainFileId: u32,
    pub latestFiles: Vec<CurseForgeFile>,
    pub latestFilesIndexes: Vec<CurseForgeFileIndex>,
    pub latestEarlyAccessFilesIndexes: Vec<CurseForgeFileIndex>,
    pub dateCreated: String,
    pub dateModified: String,
    pub dateReleased: String,
    pub allowModDistribution: Option<bool>,
    pub gamePopularityRank: u32,
    pub isAvailable: bool,
    pub thumbsUpCount: u32,
    pub rating: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeCategory {
    pub id: u32,
    pub gameId: u32,
    pub name: String,
    pub slug: String,
    pub url: String,
    pub iconUrl: String,
    pub dateModified: String,
    pub isClass: Option<bool>,
    pub classId: Option<u32>,
    pub parentCategoryId: Option<u32>,
    pub displayIndex: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeAuthor {
    pub id: u32,
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeAttachment {
    pub id: u32,
    pub modId: u32,
    pub title: String,
    pub description: String,
    pub thumbnailUrl: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeLinks {
    pub websiteUrl: String,
    pub wikiUrl: Option<String>,
    pub issuesUrl: Option<String>,
    pub sourceUrl: Option<String>,
}

// Additional structures for files
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeFile {
    pub id: u32,
    pub gameId: u32,
    pub modId: u32,
    pub isAvailable: bool,
    pub displayName: String,
    pub fileName: String,
    pub releaseType: u32,
    pub fileStatus: u32,
    pub hashes: Vec<CurseForgeFileHash>,
    pub fileDate: String,
    pub fileLength: u64,
    pub downloadCount: u64,
    pub fileSizeOnDisk: Option<u64>, // Made optional as per API docs
    pub downloadUrl: String, // Not optional per API docs
    pub gameVersions: Vec<String>,
    pub sortableGameVersions: Vec<CurseForgeSortableGameVersion>,
    pub dependencies: Vec<CurseForgeDependency>,
    pub exposeAsAlternative: Option<bool>,
    pub parentProjectFileId: Option<u32>,
    pub alternateFileId: Option<u32>,
    pub isServerPack: Option<bool>,
    pub serverPackFileId: Option<u32>,
    pub isEarlyAccessContent: Option<bool>,
    pub earlyAccessEndDate: Option<String>,
    pub fileFingerprint: u64,
    pub modules: Vec<CurseForgeModule>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeFileHash {
    pub value: String,
    pub algo: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeSortableGameVersion {
    pub gameVersionName: String,
    pub gameVersionPadded: String,
    pub gameVersion: String,
    pub gameVersionReleaseDate: String,
    pub gameVersionTypeId: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeDependency {
    pub modId: u32,
    pub relationType: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeModule {
    pub name: String,
    pub fingerprint: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeFileIndex {
    pub gameVersion: String,
    pub fileId: u32,
    pub filename: String,
    pub releaseType: u32,
    pub gameVersionTypeId: Option<u32>,
    pub modLoader: Option<u32>,
}

// Function to search for mods on CurseForge
pub async fn search_mods(
    game_id: u32,
    search_filter: Option<String>,
    class_id: Option<u32>,
    category_id: Option<u32>,
    game_version: Option<String>,
    sort_field: Option<CurseForgeModSearchSortField>,
    sort_order: Option<CurseForgeSortOrder>,
    mod_loader_type: Option<CurseForgeModLoaderType>,
    game_version_type_id: Option<u32>,
    index: Option<u32>,
    page_size: Option<u32>,
) -> Result<CurseForgeSearchResponse> {
    let url = format!("{}/mods/search", CURSEFORGE_API_BASE_URL);

    let mut query_params: Vec<(String, String)> = Vec::new();

    // Add required gameId
    query_params.push(("gameId".to_string(), game_id.to_string()));

    // Add optional searchFilter
    if let Some(filter) = search_filter {
        query_params.push(("searchFilter".to_string(), filter.clone()));
        log::debug!("CurseForge search - Search filter: {}", filter);
    }

    // Add optional classId
    if let Some(class) = class_id {
        query_params.push(("classId".to_string(), class.to_string()));
        log::debug!("CurseForge search - Class ID: {}", class);
    }

    // Add optional categoryId
    if let Some(category) = category_id {
        query_params.push(("categoryId".to_string(), category.to_string()));
        log::debug!("CurseForge search - Category ID: {}", category);
    }

    // Add optional gameVersion
    if let Some(version) = game_version {
        query_params.push(("gameVersion".to_string(), version.clone()));
        log::debug!("CurseForge search - Game version: {}", version);
    }

    // Add optional sortField
    if let Some(sort) = sort_field {
        query_params.push(("sortField".to_string(), (sort.clone() as u32).to_string()));
        log::debug!("CurseForge search - Sort field: {:?}", sort);
    }

    // Add optional sortOrder
    if let Some(order) = sort_order {
        query_params.push(("sortOrder".to_string(), order.to_string()));
        log::debug!("CurseForge search - Sort order: {:?}", order);
    }

    // Add optional modLoaderType
    if let Some(loader) = mod_loader_type {
        query_params.push(("modLoaderType".to_string(), (loader.clone() as u32).to_string()));
        log::debug!("CurseForge search - Mod loader type: {:?}", loader);
    }

    // Add optional gameVersionTypeId
    if let Some(version_type) = game_version_type_id {
        query_params.push(("gameVersionTypeId".to_string(), version_type.to_string()));
        log::debug!("CurseForge search - Game version type ID: {}", version_type);
    }

    // Add optional index for pagination
    if let Some(idx) = index {
        query_params.push(("index".to_string(), idx.to_string()));
        log::debug!("CurseForge search - Index: {}", idx);
    }

    // Add optional pageSize
    if let Some(size) = page_size {
        query_params.push(("pageSize".to_string(), size.to_string()));
        log::debug!("CurseForge search - Page size: {}", size);
    }

    // Build the final URL with query parameters
    let final_url = reqwest::Url::parse_with_params(&url, &query_params)
        .map_err(|e| AppError::Other(format!("Failed to build CurseForge search URL: {}", e)))?;

    log::info!("Searching CurseForge: {}", final_url);

    let response = HTTP_CLIENT
        .get(final_url)
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| AppError::Other(format!("CurseForge API request failed: {}", e)))?;

    let status = response.status();
    let content_type = response
        .headers()
        .get("content-type")
        .map(|ct| ct.to_str().unwrap_or("unknown"))
        .unwrap_or("missing");

    log::debug!("CurseForge API response - Status: {}, Content-Type: {}", status, content_type);

    // Always read the response body as text first for better error handling
    let response_text = response
        .text()
        .await
        .map_err(|e| AppError::Other(format!("Failed to read CurseForge response body: {}", e)))?;

    // Log response body for debugging (truncated if too long)
    const MAX_BODY_LOG_LENGTH: usize = 2000;
    let logged_body = if response_text.len() > MAX_BODY_LOG_LENGTH {
        format!("{}... (truncated, full length: {})", &response_text[..MAX_BODY_LOG_LENGTH], response_text.len())
    } else {
        response_text.clone()
    };
    log::debug!("CurseForge API response body: {}", logged_body);

    // Check for HTTP errors
    if !status.is_success() {
        log::error!("CurseForge API HTTP error ({}): {}", status, response_text);
        return Err(AppError::Other(format!(
            "CurseForge API returned HTTP error {}: {}",
            status, response_text
        )));
    }

    // Try to parse the JSON response
    let search_response: CurseForgeSearchResponse = match serde_json::from_str(&response_text) {
        Ok(parsed) => parsed,
        Err(parse_err) => {
            log::error!(
                "CurseForge JSON parsing failed. Parse error: {}. Response body (first 500 chars): {}",
                parse_err,
                &response_text[..response_text.len().min(500)]
            );

            // Try to parse as error response
            if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(&response_text) {
                log::error!("Parsed response as generic JSON: {}", error_response);
            }

            return Err(AppError::Other(format!(
                "Failed to parse CurseForge JSON response: {}. Response starts with: {}",
                parse_err,
                &response_text[..response_text.len().min(200)]
            )));
        }
    };

    log::info!(
        "Found {} mods out of {} total",
        search_response.data.len(),
        search_response.pagination.totalCount
    );

    Ok(search_response)
}

// Enum for sort fields in mod search
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CurseForgeModSearchSortField {
    Featured = 1,
    Popularity = 2,
    LastUpdated = 3,
    Name = 4,
    Author = 5,
    TotalDownloads = 6,
    Category = 7,
    GameVersion = 8,
    EarlyAccess = 9,
    FeaturedReleased = 10,
    ReleasedDate = 11,
    Rating = 12,
}

// Enum for sort order
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CurseForgeSortOrder {
    Asc = 1,
    Desc = 2,
}

impl CurseForgeSortOrder {
    pub fn to_string(&self) -> String {
        match self {
            CurseForgeSortOrder::Asc => "asc".to_string(),
            CurseForgeSortOrder::Desc => "desc".to_string(),
        }
    }
}

// Enum for mod loader types
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CurseForgeModLoaderType {
    Any = 0,
    Forge = 1,
    Cauldron = 2,
    LiteLoader = 3,
    Fabric = 4,
    Quilt = 5,
    NeoForge = 6,
}
