use crate::error::CommandError;
use crate::state::state_manager::State;
use crate::state::process_state::ProcessMetadata;
use tauri::Manager;
use uuid::Uuid;

#[tauri::command]
pub async fn get_processes() -> Result<Vec<ProcessMetadata>, CommandError> {
    let state = State::get().await?;
    let processes = state.process_manager.list_processes().await;
    Ok(processes)
}

#[tauri::command]
pub async fn get_process(process_id: Uuid) -> Result<Option<ProcessMetadata>, CommandError> {
    let state = State::get().await?;
    let process = state.process_manager.get_process_metadata(process_id).await;
    Ok(process)
}

#[tauri::command]
pub async fn get_processes_by_profile(profile_id: Uuid) -> Result<Vec<ProcessMetadata>, CommandError> {
    let state = State::get().await?;
    let processes = state.process_manager.get_process_metadata_by_profile(profile_id).await;
    Ok(processes)
}

#[tauri::command]
pub async fn stop_process(process_id: Uuid) -> Result<(), CommandError> {
    let state = State::get().await?;
    state.process_manager.stop_process(process_id).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_full_log(
    process_id: Uuid,
) -> Result<String, CommandError> {
    let state = State::get().await?;
    let log_content = state.process_manager.get_full_log_content(process_id).await?;
    Ok(log_content)
}

#[tauri::command]
pub async fn open_log_window<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), CommandError> {
    // Close any existing log window
    if let Some(window) = app.get_webview_window("log_window") {
        window.set_focus().ok();
        return Ok(());
    }

    // Create a new window for the log viewer
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "log_window",
        tauri::WebviewUrl::App("/log-window".into()),
    )
    .title("Minecraft Logs")
    .inner_size(1200.0, 800.0)
    .center()
    .build()
    .map_err(|e| CommandError::from(crate::error::AppError::Other(e.to_string())))?;

    Ok(())
}
