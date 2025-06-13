use crate::error::{AppError, CommandError};
use crate::minecraft::minecraft_auth::Credentials;
use crate::state::state_manager::State;
use chrono::{Duration, Utc};
use tauri::plugin::TauriPlugin;
use tauri::Manager;
use tauri::{Runtime, UserAttentionType};
use uuid::Uuid;

//TODO das wäre geiler aber habs noch nicht hinbekommen
//Error during login: minecraft_auth.begin_login not allowed. Plugin not found
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("minecraft_auth")
        .invoke_handler(tauri::generate_handler![
            begin_login,
            remove_account,
            get_active_account,
            set_active_account,
            get_accounts,
        ])
        .build()
}

/// Begin the Minecraft login flow
/// Returns a URL that the user needs to visit to sign in
#[tauri::command]
pub async fn begin_login<R: Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Option<Credentials>, CommandError> {
    let flow = State::get()
        .await?
        .minecraft_account_manager_v2
        .login_begin()
        .await?;

    // Close any existing sign-in window
    if let Some(window) = app.get_webview_window("signin") {
        window.close().map_err(|e| AppError::Other(e.to_string()))?;
    }

    // Create a new window for the sign-in process
    let window =
        tauri::WebviewWindowBuilder::new(
            &app,
            "signin",
            tauri::WebviewUrl::External(flow.redirect_uri.parse().map_err(|_| {
                AppError::AccountError("Error parsing auth redirect URL".to_string())
            })?),
        )
        .title("Sign into Minecraft")
        .always_on_top(true)
        .center()
        .build()
        .map_err(|e| AppError::Other(e.to_string()))?;

    window
        .request_user_attention(Some(UserAttentionType::Critical))
        .map_err(|e| AppError::Other(e.to_string()))?;

    let start = Utc::now();

    // Wait for the user to complete the login (10 minutes = 600 seconds)
    while (Utc::now() - start) < Duration::seconds(600) {
        if window.title().is_err() {
            // User closed the window, cancelling flow
            window.close().map_err(|e| AppError::Other(e.to_string()))?;
            return Ok(None);
        }

        if let Ok(url) = window.url() {
            if url
                .as_str()
                .starts_with("https://login.live.com/oauth20_desktop.srf")
            {
                if let Some((_, code)) = url.query_pairs().find(|x| x.0 == "code") {
                    window.close().map_err(|e| AppError::Other(e.to_string()))?;

                    // Complete the login flow with the code
                    let account = State::get()
                        .await?
                        .minecraft_account_manager_v2
                        .login_finish(&code, flow)
                        .await?;

                    // Add the account to the manager
                    //state.minecraft_account_manager.add_account(account.clone()).await?;

                    return Ok(Some(account));
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    window.close().map_err(|e| AppError::Other(e.to_string()))?;
    Ok(None)
}

/// Remove a Minecraft account
#[tauri::command]
pub async fn remove_account(account_id: Uuid) -> Result<(), CommandError> {
    let state = State::get().await?;
    state
        .minecraft_account_manager_v2
        .remove_account(account_id)
        .await?;
    Ok(())
}

/// Get the currently active Minecraft account
#[tauri::command]
pub async fn get_active_account() -> Result<Option<Credentials>, CommandError> {
    let state = State::get().await?;
    let account = state
        .minecraft_account_manager_v2
        .get_active_account()
        .await?;
    Ok(account)
}

/// Set the active Minecraft account
#[tauri::command]
pub async fn set_active_account(account_id: Uuid) -> Result<(), CommandError> {
    let state = State::get().await?;
    state
        .minecraft_account_manager_v2
        .set_active_account(account_id)
        .await?;
    Ok(())
}

/// Get all Minecraft accounts
#[tauri::command]
pub async fn get_accounts() -> Result<Vec<Credentials>, CommandError> {
    let state = State::get().await?;
    let accounts = state
        .minecraft_account_manager_v2
        .get_all_accounts()
        .await?;
    Ok(accounts)
}
