use crate::minecraft::auth::minecraft_auth::NoRiskToken;
use crate::minecraft::dto::norisk_meta::NoriskAssets;
use crate::{
    config::HTTP_CLIENT,
    error::{AppError, Result},
};
use log::{debug, error, info, warn};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub struct NoRiskApi;

impl NoRiskApi {
    pub fn new() -> Self {
        Self
    }

    pub fn get_api_base(is_experimental: bool) -> String {
        if is_experimental {
            debug!("[NoRisk API] Using experimental API endpoint");
            String::from("https://api-staging.norisk.gg/api/v1")
        } else {
            debug!("[NoRisk API] Using production API endpoint");
            String::from("https://api.norisk.gg/api/v1")
        }
    }

    pub async fn post_from_norisk_endpoint_with_parameters<T: for<'de> Deserialize<'de>>(
        endpoint: &str,
        norisk_token: &str,
        params: &str,
        extra_params: Option<HashMap<&str, &str>>,
        is_experimental: bool,
    ) -> Result<T> {
        let base_url = Self::get_api_base(is_experimental);
        let url = format!("{}/{}", base_url, endpoint);

        debug!("[NoRisk API] Making request to endpoint: {}", endpoint);
        debug!("[NoRisk API] Full URL: {}", url);

        let mut query_params: HashMap<&str, &str> = HashMap::new();
        if !params.is_empty() {
            query_params.insert("params", params);
            debug!("[NoRisk API] Added base params: {}", params);
        }

        if let Some(extra) = extra_params {
            for (key, value) in extra {
                query_params.insert(key, value);
                debug!("[NoRisk API] Added extra param: {} = {}", key, value);
            }
        }

        debug!(
            "[NoRisk API] Sending POST request with {} parameters",
            query_params.len()
        );
        let response = HTTP_CLIENT
            .post(url)
            .header("Authorization", format!("Bearer {}", norisk_token))
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                error!("[NoRisk API] Request failed: {}", e);
                AppError::RequestError(format!("Failed to send request to NoRisk API: {}", e))
            })?;

        let status = response.status();
        debug!("[NoRisk API] Response status: {}", status);

        if !status.is_success() {
            error!("[NoRisk API] Error response: Status {}", status);
            return Err(AppError::RequestError(format!(
                "NoRisk API returned error status: {}",
                status
            )));
        }

        debug!("[NoRisk API] Parsing response body as JSON");
        response.json::<T>().await.map_err(|e| {
            error!("[NoRisk API] Failed to parse response: {}", e);
            AppError::ParseError(format!("Failed to parse NoRisk API response: {}", e))
        })
    }

    pub async fn refresh_norisk_token(token: &str, hwid: &str, force: bool, is_experimental: bool) -> Result<NoRiskToken> {
        info!("[NoRisk API] Refreshing NoRisk token with HWID: {}", hwid);
        debug!("[NoRisk API] Force refresh: {}", force);
        debug!("[NoRisk API] Experimental mode: {}", is_experimental);

        let force_str = force.to_string();
        let mut extra_params = HashMap::new();
        extra_params.insert("force", force_str.as_str());
        extra_params.insert("hwid", hwid);

        debug!("[NoRisk API] Calling validation endpoint");
        match Self::post_from_norisk_endpoint_with_parameters::<NoRiskToken>(
            "launcher/auth/validate",
            token,
            "",
            Some(extra_params),
            is_experimental,
        )
        .await
        {
            Ok(token) => {
                info!("[NoRisk API] Token refresh successful");
                debug!("[NoRisk API] Token valid status: {}", token.value.len() > 0);
                Ok(token)
            }
            Err(e) => {
                error!("[NoRisk API] Token refresh failed: {:?}", e);
                Err(e)
            }
        }
    }

    pub async fn request_from_norisk_endpoint<T: for<'de> Deserialize<'de>>(
        endpoint: &str,
        norisk_token: &str,
        request_uuid: &str,
        is_experimental: bool,
    ) -> Result<T> {
        debug!("[NoRisk API] Request from endpoint: {} with UUID: {}", endpoint, request_uuid);
        let mut extra_params = HashMap::new();
        extra_params.insert("uuid", request_uuid);
        
        Self::post_from_norisk_endpoint_with_parameters(endpoint, norisk_token, "", Some(extra_params), is_experimental).await
    }

    /// Request norisk assets json for specific branch
    pub async fn norisk_assets(branch: &str, norisk_token: &str, request_uuid: &str, is_experimental: bool) -> Result<NoriskAssets> {
        Self::request_from_norisk_endpoint(&format!("launcher/assets/{}", branch), norisk_token, request_uuid, is_experimental).await
    }

    // Add more NoRisk API methods as needed
}
