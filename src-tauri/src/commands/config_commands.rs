use crate::error::{AppError, CommandError};
use crate::state::{config_state::LauncherConfig, State};
use tauri::{command, Runtime};

type Result<T> = std::result::Result<T, CommandError>;

#[command]
pub async fn get_launcher_config() -> Result<LauncherConfig> {
    let state = State::get().await?;
    let config = state.config_manager.get_config().await;
    Ok(config)
}

#[command]
pub async fn set_experimental_mode(enabled: bool) -> Result<bool> {
    let state = State::get().await?;
    state.config_manager.set_experimental_mode(enabled).await?;
    Ok(enabled)
}

#[command]
pub async fn set_auto_check_updates(enabled: bool) -> Result<bool> {
    let state = State::get().await?;
    state.config_manager.set_auto_check_updates(enabled).await?;
    Ok(enabled)
}

#[command]
pub async fn set_concurrent_downloads(count: usize) -> Result<usize> {
    if count == 0 || count > 10 {
        return Err(CommandError::from(AppError::Other(format!(
            "Concurrent downloads must be between 1 and 10 (got: {})",
            count
        ))));
    }

    let state = State::get().await?;
    state.config_manager.set_concurrent_downloads(count).await?;
    Ok(count)
}

#[command]
pub async fn set_launcher_config(config: LauncherConfig) -> Result<LauncherConfig> {
    let state = State::get().await?;
    
    // Validate concurrent downloads value
    if config.concurrent_downloads == 0 || config.concurrent_downloads > 10 {
        return Err(CommandError::from(AppError::Other(format!(
            "Concurrent downloads must be between 1 and 10 (got: {})",
            config.concurrent_downloads
        ))));
    }
    
    // Set the entire configuration
    state.config_manager.set_config(config.clone()).await?;
    
    // Return the updated config
    Ok(config)
}
