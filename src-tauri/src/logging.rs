use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use chrono::Utc;
use log::LevelFilter;
use log4rs::encode::Encode;
use log4rs::encode::writer::simple::SimpleWriter;
use norisk_logging::{
    mask_sensitive_data, LogSetup, RedactingEncoder, FILE_PATTERN as LOG_PATTERN,
};
use once_cell::sync::Lazy;
use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

const LOG_DIR_NAME: &str = "logs";
const LOG_FILE_NAME: &str = "launcher.log";
const DEBUG_DUMP_FILE_PREFIX: &str = "launcher-debug";
const LOG_FILE_SIZE_LIMIT_BYTES: u64 = 4_800_000; // ~4.8MB to fit Discord's 8MB upload limit
const DEBUG_RING_BUFFER_MAX_BYTES: usize = LOG_FILE_SIZE_LIMIT_BYTES as usize;
const DEBUG_DUMP_FILE_MAX_COUNT: usize = 3;

#[derive(Debug, Default)]
struct DebugRingBufferState {
    lines: VecDeque<String>,
    bytes: usize,
}

static DEBUG_RING_BUFFER: Lazy<Mutex<DebugRingBufferState>> =
    Lazy::new(|| Mutex::new(DebugRingBufferState::default()));

#[derive(Debug)]
struct DebugRingBufferAppender {
    encoder: Box<dyn Encode>,
}

impl DebugRingBufferAppender {
    fn new() -> Self {
        Self {
            encoder: Box::new(RedactingEncoder::new(LOG_PATTERN)),
        }
    }

    fn push_line(&self, line: String) {
        if let Ok(mut state) = DEBUG_RING_BUFFER.lock() {
            let line_bytes = line.as_bytes().len();

            while state.bytes + line_bytes > DEBUG_RING_BUFFER_MAX_BYTES {
                match state.lines.pop_front() {
                    Some(removed) => {
                        state.bytes = state.bytes.saturating_sub(removed.as_bytes().len());
                    }
                    None => break,
                }
            }

            state.bytes += line_bytes;
            state.lines.push_back(line);
        }
    }
}

impl log::Log for DebugRingBufferAppender {
    fn enabled(&self, _metadata: &log::Metadata) -> bool {
        true
    }

    fn log(&self, record: &log::Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        let mut encoded = Vec::new();
        {
            let mut writer = SimpleWriter(&mut encoded);
            if let Err(e) = self.encoder.encode(&mut writer, record) {
                eprintln!("[Logging] Failed to encode debug ring buffer line: {}", e);
                return;
            }
        }

        self.push_line(String::from_utf8_lossy(&encoded).into_owned());

        if record.level() == log::Level::Error {
            let reason = format!("error: {}", record.args());
            if let Err(e) = dump_debug_buffer_to_file(&reason) {
                eprintln!("[Logging] Failed to dump debug ring buffer on error: {}", e);
            }
        }
    }

    fn flush(&self) {}
}

pub fn dump_debug_buffer_to_file(
    reason: &str,
) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    let log_dir = LAUNCHER_DIRECTORY.root_dir().join(LOG_DIR_NAME);
    std::fs::create_dir_all(&log_dir)?;

    let timestamp = Utc::now().format("%Y%m%d-%H%M%S%.3f");
    let dump_file_path = log_dir.join(format!("{}-{}.log", DEBUG_DUMP_FILE_PREFIX, timestamp));

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&dump_file_path)?;

    writeln!(file, "# NoRisk Launcher Debug Buffer Dump")?;
    writeln!(file, "# Timestamp (UTC): {}", Utc::now().to_rfc3339())?;
    writeln!(file, "# Reason: {}", mask_sensitive_data(reason))?;
    let (current_buffer_len, current_buffer_bytes) = DEBUG_RING_BUFFER
        .lock()
        .map(|state| (state.lines.len(), state.bytes))
        .unwrap_or((0, 0));
    writeln!(
        file,
        "# Buffered Lines: {}",
        current_buffer_len,
    )?;
    writeln!(
        file,
        "# Buffered Bytes: {} (max {})",
        current_buffer_bytes,
        DEBUG_RING_BUFFER_MAX_BYTES
    )?;
    writeln!(file)?;

    if let Ok(state) = DEBUG_RING_BUFFER.lock() {
        for line in state.lines.iter() {
            file.write_all(line.as_bytes())?;
        }
    }

    prune_old_debug_dump_files(&log_dir)?;

    Ok(dump_file_path)
}

fn prune_old_debug_dump_files(log_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let mut dump_files = std::fs::read_dir(log_dir)?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_string_lossy();

            if !file_name.starts_with(DEBUG_DUMP_FILE_PREFIX) || !file_name.ends_with(".log") {
                return None;
            }

            let modified = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .ok()?;

            Some((path, modified))
        })
        .collect::<Vec<_>>();

    dump_files.sort_by(|a, b| b.1.cmp(&a.1));

    for (path, _) in dump_files.into_iter().skip(DEBUG_DUMP_FILE_MAX_COUNT) {
        let _ = std::fs::remove_file(path);
    }

    Ok(())
}

/// Initializes the logging system using log4rs.
/// Configures a rolling file appender and a console appender.
pub const DEFAULT_LOG_LEVEL: LevelFilter = LevelFilter::Debug;

pub fn env_log_level() -> Option<LevelFilter> {
    std::env::var("NRC_LOG_LEVEL")
        .ok()
        .and_then(|value| value.trim().parse::<LevelFilter>().ok())
}

pub fn current_log_level() -> LevelFilter {
    norisk_logging::current_level()
}

pub async fn setup_logging() -> Result<(), Box<dyn std::error::Error>> {
    let log_dir = LAUNCHER_DIRECTORY.root_dir().join(LOG_DIR_NAME);
    let from_env = env_log_level();
    let root_level = from_env.unwrap_or(DEFAULT_LOG_LEVEL);

    let setup = LogSetup::new(log_dir, LOG_FILE_NAME)
        .level(root_level)
        .quiet("sqlx::query", LevelFilter::Warn)
        .quiet("hyper", LevelFilter::Info)
        .quiet("hyper_util", LevelFilter::Info)
        .quiet("reqwest", LevelFilter::Info)
        .appender(
            "debug_ring_buffer",
            std::sync::Arc::new(DebugRingBufferAppender::new()),
        );

    let log_path = norisk_logging::init(setup)?;

    log::info!(
        "Logging initialized (level: {}{}). Log directory: {}",
        root_level,
        if from_env.is_some() {
            ", from NRC_LOG_LEVEL"
        } else {
            ""
        },
        log_path.parent().unwrap_or(&log_path).display()
    );

    Ok(())
}

#[cfg(test)]
#[path = "logging_test.rs"]
mod tests;

pub fn set_log_level(level: LevelFilter) {
    let was = current_log_level();
    match norisk_logging::set_level(level) {
        Ok(()) if was != level => log::info!("Log level changed: {} -> {}", was, level),
        Ok(()) => {}
        Err(e) => log::error!("Failed to rebuild logging config for level {}: {}", level, e),
    }
}
