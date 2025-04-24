use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::state::{self, State};
use crate::state::event_state::{EventState, EventPayload, EventType, MinecraftProcessExitedPayload};
use chrono::{DateTime, Utc};
use log;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncSeekExt, BufReader};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use sysinfo::{Pid, System, ProcessesToUpdate};
use tokio::fs::{self as async_fs, File};
use tokio::sync::Mutex;
use tokio::sync::RwLock;
use uuid::Uuid;
use tokio::time::{interval, Duration};
use std::process::ExitStatus;

const PROCESSES_FILENAME: &str = "processes.json";

pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<Uuid, Process>>>,
    processes_file_path: PathBuf,
    save_lock: Mutex<()>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetadata {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub state: ProcessState,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessState {
    Starting,
    Running,
    Stopping,
    Stopped,
    Crashed(String),
}

#[derive(Debug)]
struct Process {
    metadata: ProcessMetadata,
    last_log_position: Arc<Mutex<u64>>,
}

#[derive(Clone, serde::Serialize)]
struct ProcessLogEvent {
    process_id: Uuid,
    line: String,
}

impl ProcessManager {
    pub async fn new(processes_file_path: PathBuf) -> Result<Self> {
        log::info!(
            "Initializing ProcessManager with state file: {:?}",
            processes_file_path
        );
        let processes = Arc::new(RwLock::new(HashMap::new()));
        let save_lock = Mutex::new(());
        
        let processes_clone = Arc::clone(&processes);

        let manager = Self {
            processes: processes_clone,
            processes_file_path: processes_file_path.clone(),
            save_lock,
        };
        manager.load_processes().await?;

        let manager_clone = Arc::clone(&manager.processes);
        tokio::spawn(Self::periodic_process_check(manager_clone));

        let tailer_processes_arc = Arc::clone(&manager.processes);
        tokio::spawn(Self::periodic_log_tailer(tailer_processes_arc));

        Ok(manager)
    }

    async fn load_processes(&self) -> Result<()> {
        let file_path = &self.processes_file_path;

        if !file_path.exists() {
            log::info!(
                "Processes file not found ('{:?}'), starting fresh.",
                file_path
            );
            return Ok(());
        }

        log::info!("Loading processes metadata from '{:?}'...", file_path);

        let json_content = async_fs::read_to_string(&file_path).await.map_err(|e| {
            log::error!(
                "Failed to read processes file async '{:?}': {}.",
                file_path,
                e
            );
            AppError::Io(e)
        })?;

        match serde_json::from_str::<Vec<ProcessMetadata>>(&json_content) {
            Ok(loaded_metadata) => {
                log::info!(
                    "Successfully deserialized {} process metadata entries.",
                    loaded_metadata.len()
                );
                let mut sys = System::new();
                let pids_to_refresh: Vec<Pid> = loaded_metadata
                    .iter()
                    .map(|meta| Pid::from(meta.pid as usize))
                    .collect();
                sys.refresh_processes(ProcessesToUpdate::Some(&pids_to_refresh), false);
                let mut loaded_count = 0;

                let mut processes_map = self.processes.write().await;

                for mut metadata in loaded_metadata {
                    let process_pid = Pid::from(metadata.pid as usize);
                    if sys.process(process_pid).is_some() {
                        if metadata.state == ProcessState::Starting
                            || metadata.state == ProcessState::Stopping
                        {
                            log::warn!(
                                "Process {} (PID: {}) was in state {:?}, assuming Running on load.",
                                metadata.id,
                                metadata.pid,
                                metadata.state
                            );
                            metadata.state = ProcessState::Running;
                        }
                        log::info!(
                            "Loading running process {} (PID: {}) metadata.",
                            metadata.id,
                            metadata.pid
                        );
                        let process_entry = Process {
                            metadata,
                            last_log_position: Arc::new(Mutex::new(0)),
                        };
                        processes_map.insert(process_entry.metadata.id, process_entry);
                        loaded_count += 1;
                    } else {
                        log::warn!(
                            "Ignoring stale process entry {} (PID: {}): Process not found.",
                            metadata.id,
                            metadata.pid
                        );
                    }
                }
                log::info!(
                    "Created {} active Process entries from loaded metadata. Tailing active only for newly started.",
                    loaded_count
                );
            }
            Err(e) => {
                log::error!(
                    "Failed to deserialize processes metadata from '{:?}': {}. Starting fresh.",
                    file_path,
                    e
                );
            }
        }

        Ok(())
    }

    async fn save_processes(&self) -> Result<()> {
        let _guard = self.save_lock.lock().await;
        log::debug!("Acquired save lock, proceeding to save processes...");

        if let Some(parent_dir) = self.processes_file_path.parent() {
            if !parent_dir.exists() {
                async_fs::create_dir_all(parent_dir).await.map_err(AppError::Io)?;
                log::info!("Created directory for processes file: {:?}", parent_dir);
            }
        }

        let processes_map = self.processes.read().await;
        let metadata_list: Vec<ProcessMetadata> = processes_map
            .values()
            .map(|entry| entry.metadata.clone())
            .collect();
        drop(processes_map);

        let json_content = serde_json::to_string_pretty(&metadata_list).map_err(|e| {
            AppError::Other(format!("Failed to serialize processes metadata: {}", e))
        })?;

        async_fs::write(&self.processes_file_path, json_content)
            .await
            .map_err(AppError::Io)?;

        log::info!(
            "Successfully saved {} process metadata entries to '{:?}'.",
            metadata_list.len(),
            &self.processes_file_path
        );

        Ok(())
    }

    pub async fn start_process(
        &self,
        profile_id: Uuid,
        mut command: std::process::Command,
    ) -> Result<Uuid> {
        log::info!("Attempting to start process for profile {}", profile_id);

        #[cfg(unix)]
        {
            // Potentially unnecessary if handled by dropping Child, but kept for safety
            // use std::os::unix::process::CommandExt;
            // log::debug!("Applying setsid for Unix detachment.");
            // command.setsid(); // Consider if really needed
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const DETACHED_PROCESS: u32 = 0x00000008;
            const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
            log::debug!(
                "Applying DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP for Windows detachment."
            );
            command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
        }
        
        let mut tokio_command = tokio::process::Command::from(command);
        let mut child = tokio_command.spawn().map_err(|e| {
            log::error!("Failed to spawn process using tokio::process::Command: {}", e);
            AppError::ProcessSpawnFailed(e.to_string())
        })?;

        let pid = child.id().ok_or_else(|| {
            log::error!("Failed to get PID immediately after spawning process.");
            AppError::ProcessSpawnFailed("Could not get PID".to_string())
        })?;
        let process_id = Uuid::new_v4();

        let metadata = ProcessMetadata {
            id: process_id,
            profile_id,
            start_time: Utc::now(),
            state: ProcessState::Running,
            pid,
        };

        log::info!(
            "Process spawned successfully. ID: {}, PID: {}",
            process_id,
            pid
        );

        let process_entry = Process {
            metadata: metadata.clone(),
            last_log_position: Arc::new(Mutex::new(0)),
        };

        {
            let mut processes_map = self.processes.write().await;
            processes_map.insert(process_id, process_entry);
        }
        
        if let Err(e) = self.save_processes().await {
             log::error!(
                 "Failed to save processes state immediately after starting {}: {}",
                 process_id,
                 e
            );
        }

        let processes_arc_clone = Arc::clone(&self.processes);
        let state_clone_res = State::get().await;

        tokio::spawn(async move {
            let state = match state_clone_res {
                 Ok(s) => s,
                 Err(e) => {
                    log::error!("Monitor task for process {} failed to get global state: {}. Cannot report exit.", process_id, e);
                    let mut processes_map = processes_arc_clone.write().await;
                    processes_map.remove(&process_id);
                    log::warn!("Removed process entry {} due to state access failure in monitor task.", process_id);
                    return;
                 }
            };
            let event_state = &state.event_state;

            log::info!("Monitor task started for process {} (PID: {})", process_id, pid);

            let exit_status_res = child.wait().await;

            let exit_status: Option<ExitStatus> = match exit_status_res {
                Ok(status) => {
                    log::info!("Process {} (PID: {}) exited with status: {:?}", process_id, pid, status);
                    Some(status)
                }
                Err(e) => {
                    log::error!("Failed to wait for process {} (PID: {}): {}", process_id, pid, e);
                    None
                }
            };

            let exit_code: Option<i32> = exit_status.and_then(|s| s.code());
            let success: bool = exit_code == Some(0);

            // Create the specific payload
            let specific_payload = MinecraftProcessExitedPayload {
                profile_id,
                process_id,
                exit_code,
                success,
            };

            // Serialize the specific payload to JSON
            let specific_payload_json = serde_json::to_string(&specific_payload)
                .unwrap_or_else(|e| {
                    log::error!("Failed to serialize MinecraftProcessExitedPayload for {}: {}", process_id, e);
                    // Provide a fallback JSON error message if serialization fails
                    format!("{{\"error\":\"Failed to serialize payload: {}\", \"process_id\":\"{}\"}}", e, process_id)
                });

            log::info!("Emitting MinecraftProcessExited event for process {} with JSON payload: {}", 
                      process_id, specific_payload_json);

            // Create the generic payload using the JSON string in the message field
            let generic_payload = EventPayload {
                 event_id: Uuid::new_v4(),
                 event_type: EventType::MinecraftProcessExited,
                 target_id: Some(process_id),
                 message: specific_payload_json, // <-- Use the JSON string here
                 progress: None,
                 // Error field just indicates if there was an error, details are in the message JSON
                 error: if success { None } else { Some("Process exited non-zero".to_string()) },
            };

            if let Err(e) = event_state.emit(generic_payload).await {
                log::error!("Failed to emit MinecraftProcessExited event for process {}: {}", process_id, e);
            }

            log::info!("Removing process entry {} from manager.", process_id);
            {
                let mut processes_map = processes_arc_clone.write().await;
                if processes_map.remove(&process_id).is_none() {
                     log::warn!("Process entry {} was already removed before monitor task cleanup.", process_id);
                }
            }

            log::debug!("Monitor task finished for process {}", process_id);
        });

        Ok(process_id)
    }

    pub async fn stop_process(&self, process_id: Uuid) -> Result<()> {
        log::info!("Attempting to stop process {}", process_id);

        let mut kill_successful = false;
        let mut final_state = ProcessState::Stopped;
        let mut pid_for_error: u32 = 0;

        let mut processes_map = self.processes.write().await;

        if let Some(process) = processes_map.get_mut(&process_id) {
            pid_for_error = process.metadata.pid;
            process.metadata.state = ProcessState::Stopping;

            let pid_to_kill = process.metadata.pid;
            log::info!(
                "Attempting to kill process {} via PID {}",
                process_id,
                pid_to_kill
            );
            let mut sys = System::new();
            let pid_to_refresh = Pid::from(pid_to_kill as usize);
            sys.refresh_processes(ProcessesToUpdate::Some(&[pid_to_refresh]), false);

            if let Some(sys_process) = sys.process(pid_to_refresh) {
                if sys_process.kill() {
                    log::info!("Kill signal sent successfully to PID {}.", pid_to_kill);
                    kill_successful = true;
                } else {
                    log::error!("Failed to send kill signal to PID {}.", pid_to_kill);
                    final_state =
                        ProcessState::Crashed(format!("Failed to kill PID {}", pid_to_kill));
                }
            } else {
                log::warn!(
                    "Process with PID {} not found by sysinfo during stop attempt. Assuming already stopped.",
                    pid_to_kill
                );
                kill_successful = true;
            }

            // Update state based on kill attempt outcome
            process.metadata.state = final_state.clone(); // Clone here before potential move

            // Only remove if kill was considered successful (process gone or signal sent)
            if kill_successful {
                processes_map.remove(&process_id);
                log::info!("Removed process {} from manager after stop attempt.", process_id);
            } else {
                // Use the cloned state for logging
                log::warn!(
                    "Process {} could not be stopped successfully, leaving entry with state {:?}.",
                    process_id,
                    process.metadata.state // Log the state that was actually set
                );
            }
        } else {
            drop(processes_map);
            log::warn!("Process {} not found in manager for stopping.", process_id);
            return Err(AppError::ProcessNotFound(process_id));
        }

        drop(processes_map);

        if let Err(e) = self.save_processes().await {
            log::error!(
                "Failed to save processes state after stopping attempt for {}: {}",
                process_id,
                e
            );
            if kill_successful {
                 return Err(AppError::Other(format!("Failed to save state after stopping process {}: {}", process_id, e)));
            }
        }

        if kill_successful {
            Ok(())
        } else {
            Err(AppError::ProcessKillFailed(pid_for_error))
        }
    }

    pub async fn get_process_metadata(&self, process_id: Uuid) -> Option<ProcessMetadata> {
        let processes_map = self.processes.read().await;
        processes_map
            .get(&process_id)
            .map(|entry| entry.metadata.clone())
    }

    pub async fn get_process_metadata_by_profile(&self, profile_id: Uuid) -> Vec<ProcessMetadata> {
        let processes_map = self.processes.read().await;
        processes_map
            .values()
            .filter(|entry| entry.metadata.profile_id == profile_id)
            .map(|entry| entry.metadata.clone())
            .collect()
    }

    pub async fn list_processes(&self) -> Vec<ProcessMetadata> {
        let processes_map = self.processes.read().await;
        processes_map
            .values()
            .map(|entry| entry.metadata.clone())
            .collect()
    }

    async fn periodic_process_check(
        processes_arc: Arc<RwLock<HashMap<Uuid, Process>>>,
    ) {
        let mut interval = interval(Duration::from_secs(10));
        log::info!("Starting periodic process checker task. (Note: Normal exits handled by monitor tasks)");

        loop {
            interval.tick().await;
            log::trace!("Running periodic process check...");

            let mut pids_to_check: Vec<(Uuid, u32)> = Vec::new();
            {
                let processes_map = processes_arc.read().await;
                if processes_map.is_empty() {
                    log::trace!("No processes to check, skipping poll.");
                    continue;
                }
                pids_to_check = processes_map
                    .iter()
                    .map(|(id, process)| (*id, process.metadata.pid))
                    .collect();
            }

            if pids_to_check.is_empty() { continue; }

            let mut sys = System::new();
            let pids_to_refresh: Vec<Pid> = pids_to_check
                .iter()
                .map(|(_, pid_u32)| Pid::from(*pid_u32 as usize))
                .collect();
            sys.refresh_processes(ProcessesToUpdate::Some(pids_to_refresh.as_slice()), false);
            let mut dead_process_ids: Vec<Uuid> = Vec::new();

            for (id, pid) in pids_to_check {
                if sys.process(Pid::from(pid as usize)).is_none() {
                    log::warn!("Periodic check found process {} (PID: {}) no longer running (likely handled by monitor task, but marking for removal just in case).", id, pid);
                    dead_process_ids.push(id);
                }
            }

            if !dead_process_ids.is_empty() {
                log::warn!("Periodic check removing {} potentially stale process entries: {:?}", dead_process_ids.len(), dead_process_ids);
                 let mut processes_map = processes_arc.write().await;
                for id in dead_process_ids {
                     processes_map.remove(&id);
                }
            }
        }
    }

    async fn periodic_log_tailer(
        processes_arc: Arc<RwLock<HashMap<Uuid, Process>>>,
    ) {
        let mut interval = interval(Duration::from_secs(1));
        log::info!("Starting periodic log tailing task.");

        loop {
            interval.tick().await;
            log::trace!("Running periodic log tail check...");

            let app_state = match state::State::get().await {
                Ok(state) => state,
                Err(e) => {
                    log::error!("Log tailer failed to get global state: {}. Skipping cycle.", e);
                    continue;
                }
            };

            let processes_map = processes_arc.read().await;
            if processes_map.is_empty() {
                log::trace!("No processes to tail logs for.");
                drop(processes_map);
                continue;
            }

            let processes_to_tail: Vec<(Uuid, Uuid, Arc<Mutex<u64>>)> = processes_map
                .iter()
                .filter(|(_, process)| process.metadata.state == ProcessState::Running || process.metadata.state == ProcessState::Starting)
                .map(|(id, process)| (*id, process.metadata.profile_id, Arc::clone(&process.last_log_position)))
                .collect();

            drop(processes_map);

            for (process_id, profile_id, last_pos_mutex) in processes_to_tail {
                let instance_path = match app_state.profile_manager.get_profile_instance_path(profile_id).await {
                    Ok(path) => path,
                    Err(e) => {
                        log::warn!("Could not get instance path for profile {} (process {}): {}. Skipping log tail.", profile_id, process_id, e);
                        continue;
                    }
                };

                let latest_log_path = instance_path.join("logs").join("latest.log");

                if !latest_log_path.exists() {
                    log::trace!("Log file {:?} for process {} does not exist yet.", latest_log_path, process_id);
                    continue;
                }

                if let Err(e) = Self::tail_log_file(&latest_log_path, process_id, &last_pos_mutex, &app_state.event_state).await {
                     log::warn!("Error tailing log file {:?} for process {}: {}", latest_log_path, process_id, e);
                }
            }
        }
    }

    async fn tail_log_file(
        log_path: &PathBuf,
        process_id: Uuid,
        last_pos_mutex: &Arc<Mutex<u64>>,
        event_state: &EventState
    ) -> Result<()> {
        let current_metadata = tokio::fs::metadata(log_path).await.map_err(AppError::Io)?;
        let current_size = current_metadata.len();

        let mut last_pos_guard = last_pos_mutex.lock().await;
        let last_pos = *last_pos_guard;

        let mut read_from_pos = last_pos;

        if current_size < last_pos {
            log::info!("Log file {:?} seems to have rotated or shrunk (current: {}, last: {}). Resetting read position to 0.", log_path, current_size, last_pos);
            read_from_pos = 0;
        }

        let mut bytes_actually_read: u64 = 0;

        if current_size > read_from_pos {
            log::trace!("Reading new logs from {:?} for process {} (from byte {} up to {})", log_path, process_id, read_from_pos, current_size);
            let file = File::open(log_path).await.map_err(AppError::Io)?;
            let mut reader = BufReader::new(file);

            reader.seek(std::io::SeekFrom::Start(read_from_pos)).await.map_err(AppError::Io)?;

            let mut line_buffer = String::new();
            loop {
                let current_stream_pos = read_from_pos + bytes_actually_read;
                if current_stream_pos >= current_size {
                    break;
                }

                match reader.read_line(&mut line_buffer).await {
                    Ok(0) => break,
                    Ok(bytes) => {
                        let bytes_u64 = bytes as u64;
                        let trimmed_line = line_buffer.trim_end();

                        if !trimmed_line.is_empty() {
                            log::trace!("Sending line for {}: {}", process_id, trimmed_line);
                            let log_event_payload = EventPayload {
                                event_id: Uuid::new_v4(),
                                event_type: EventType::MinecraftOutput,
                                target_id: Some(process_id),
                                message: trimmed_line.to_string(),
                                progress: None,
                                error: None,
                            };
                            if let Err(e) = event_state.emit(log_event_payload).await {
                                log::error!("Failed to emit log update via EventState: {}", e);
                            }
                        }

                        bytes_actually_read += bytes_u64;
                        line_buffer.clear();

                        if read_from_pos + bytes_actually_read > current_size {
                             log::warn!("Read beyond expected size in log tailer for {:?}. Stopping read.", log_path);
                             bytes_actually_read = current_size - read_from_pos;
                             break;
                        }
                    }
                    Err(e) => {
                         log::error!("Error reading line from log file {:?}: {}", log_path, e);
                         bytes_actually_read = current_size - read_from_pos;
                         break;
                    }
                }
            }
        } else {
             log::trace!("No new logs found for process {} in {:?}", process_id, log_path);
        }

        *last_pos_guard = read_from_pos + bytes_actually_read;
        log::trace!("Updated log position for process {} to {}", process_id, *last_pos_guard);

        Ok(())
    }

    /// Retrieves the full content of the latest.log file for a given process.
    /// Internally accesses the global state to get the ProfileManager.
    pub async fn get_full_log_content(
        &self,
        process_id: Uuid,
    ) -> Result<String> {
        log::info!("Attempting to get full log content for process {}", process_id);

        // 1. Get profile_id from this ProcessManager's state
        let process_metadata = self.get_process_metadata(process_id).await
            .ok_or_else(|| {
                log::warn!("Process {} not found in ProcessManager when getting full log.", process_id);
                AppError::ProcessNotFound(process_id)
            })?;
        let profile_id = process_metadata.profile_id;
        log::debug!("Found profile_id {} for process {}", profile_id, process_id);

        // 2. Get instance_path using the global state
        let app_state = state::State::get().await?; // Get global state
        let instance_path = app_state.profile_manager.get_profile_instance_path(profile_id).await?; // Access profile manager
        let log_path = instance_path.join("logs").join("latest.log");
        log::debug!("Constructed log path for full read: {:?}", log_path);

        // 3. Read the log file content
        if !log_path.exists() {
            log::warn!("Log file not found at path: {:?}", log_path);
            return Ok("".to_string()); 
        }

        // Read file as bytes first to handle potential invalid UTF-8
        let log_bytes = async_fs::read(&log_path).await
            .map_err(|e| {
                log::error!("Failed to read log file bytes {:?}: {}", log_path, e);
                AppError::Io(e)
            })?;
        
        // Convert bytes to string, replacing invalid sequences
        let log_content = String::from_utf8_lossy(&log_bytes).to_string();

        log::info!("Successfully read {} bytes (lossy converted to string) from log file for process {}", log_bytes.len(), process_id);
        Ok(log_content)
    }
}

pub fn default_processes_path() -> PathBuf {
    LAUNCHER_DIRECTORY.root_dir().join(PROCESSES_FILENAME)
}
