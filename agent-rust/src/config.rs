//! Configuration management for the NetWatch agent.
//!
//! Handles loading, saving, and managing agent configuration from:
//! - Environment variables
//! - Configuration file (config.json)
//! - Default values

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tracing::{debug, info, warn};

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// Server URL for socket connection
    #[serde(default)]
    pub server_url: String,

    /// Auto-start on system boot
    #[serde(default = "default_true")]
    pub auto_start: bool,

    /// Screenshot capture interval in milliseconds
    #[serde(default = "default_screenshot_interval")]
    pub screenshot_interval: u64,

    /// Activity log flush interval in milliseconds
    #[serde(default = "default_activity_log_interval")]
    pub activity_log_interval: u64,

    /// Keystroke buffer size before flushing
    #[serde(default = "default_keystroke_buffer_size")]
    pub keystroke_buffer_size: usize,

    /// Heartbeat interval in milliseconds
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval: u64,

    /// Process monitoring interval in milliseconds
    #[serde(default = "default_process_interval")]
    pub process_interval: u64,

    /// Clipboard check interval in milliseconds
    #[serde(default = "default_clipboard_interval")]
    pub clipboard_interval: u64,

    /// Admin password hash (SHA256)
    #[serde(default)]
    pub admin_password_hash: Option<String>,

    /// Schedule configuration
    #[serde(default)]
    pub schedule: Option<ScheduleConfig>,
}

/// Schedule configuration for monitoring times
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleConfig {
    /// Whether schedule is enabled
    pub enabled: bool,

    /// Days of the week (0=Sunday, 6=Saturday)
    pub days: Vec<u8>,

    /// Start time (HH:MM format)
    pub start_time: String,

    /// End time (HH:MM format)
    pub end_time: String,

    /// Timezone
    pub timezone: String,
}

fn default_true() -> bool {
    true
}

fn default_screenshot_interval() -> u64 {
    5000 // 5 seconds
}

fn default_activity_log_interval() -> u64 {
    10000 // 10 seconds
}

fn default_keystroke_buffer_size() -> usize {
    100
}

fn default_heartbeat_interval() -> u64 {
    10000 // 10 seconds
}

fn default_process_interval() -> u64 {
    10000 // 10 seconds
}

fn default_clipboard_interval() -> u64 {
    2000 // 2 seconds
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            auto_start: true,
            screenshot_interval: default_screenshot_interval(),
            activity_log_interval: default_activity_log_interval(),
            keystroke_buffer_size: default_keystroke_buffer_size(),
            heartbeat_interval: default_heartbeat_interval(),
            process_interval: default_process_interval(),
            clipboard_interval: default_clipboard_interval(),
            admin_password_hash: None,
            schedule: None,
        }
    }
}

impl Config {
    /// Load configuration from file or environment variables
    pub fn load() -> Result<Self, ConfigError> {
        // Try loading from file first
        if let Some(config) = Self::load_from_file()? {
            return Ok(config);
        }

        // Fall back to environment variables
        let mut config = Config::default();
        config.load_from_env();

        Ok(config)
    }

    /// Load configuration from file
    fn load_from_file() -> Result<Option<Self>, ConfigError> {
        let config_paths = Self::get_config_paths();

        for path in config_paths {
            if path.exists() {
                debug!("Attempting to load config from: {:?}", path);
                match fs::read_to_string(&path) {
                    Ok(content) => match serde_json::from_str(&content) {
                        Ok(config) => {
                            info!("Configuration loaded from: {:?}", path);
                            return Ok(Some(config));
                        }
                        Err(e) => {
                            warn!("Failed to parse config file {:?}: {}", path, e);
                        }
                    },
                    Err(e) => {
                        warn!("Failed to read config file {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(None)
    }

    /// Load configuration from environment variables
    fn load_from_env(&mut self) {
        if let Ok(url) = std::env::var("NETWATCH_SERVER_URL") {
            self.server_url = url;
        }

        if let Ok(val) = std::env::var("NETWATCH_AUTO_START") {
            self.auto_start = val.parse().unwrap_or(true);
        }

        if let Ok(val) = std::env::var("NETWATCH_SCREENSHOT_INTERVAL") {
            if let Ok(interval) = val.parse() {
                self.screenshot_interval = interval;
            }
        }

        if let Ok(hash) = std::env::var("NETWATCH_ADMIN_PASSWORD_HASH") {
            self.admin_password_hash = Some(hash);
        }
    }

    /// Get possible configuration file paths
    fn get_config_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();

        // User data directory (highest priority - user can override)
        if let Some(proj_dirs) = ProjectDirs::from("com", "netwatch", "agent") {
            let config_dir = proj_dirs.config_dir();
            paths.push(config_dir.join("config.json"));
        }

        // Current working directory
        paths.push(PathBuf::from("config.json"));

        // Executable directory (for Windows installer)
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                paths.push(exe_dir.join("config.json"));

                // macOS .app bundle: look in Contents/Resources
                #[cfg(target_os = "macos")]
                {
                    // exe is at .app/Contents/MacOS/binary
                    // config is at .app/Contents/Resources/config.json
                    if let Some(contents_dir) = exe_dir.parent() {
                        let resources_dir = contents_dir.join("Resources");
                        paths.push(resources_dir.join("config.json"));
                    }
                }
            }
        }

        // Linux system config directory
        #[cfg(target_os = "linux")]
        {
            paths.push(PathBuf::from("/etc/netwatch/config.json"));
        }

        paths
    }

    /// Save configuration to file
    pub fn save(&self) -> Result<(), ConfigError> {
        let config_path = Self::get_config_save_path()?;

        // Ensure directory exists
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| ConfigError::Io(e.to_string()))?;
        }

        let content =
            serde_json::to_string_pretty(self).map_err(|e| ConfigError::Parse(e.to_string()))?;

        fs::write(&config_path, content).map_err(|e| ConfigError::Io(e.to_string()))?;

        info!("Configuration saved to: {:?}", config_path);
        Ok(())
    }

    /// Get the path where config should be saved
    fn get_config_save_path() -> Result<PathBuf, ConfigError> {
        if let Some(proj_dirs) = ProjectDirs::from("com", "netwatch", "agent") {
            Ok(proj_dirs.config_dir().join("config.json"))
        } else {
            Ok(PathBuf::from("config.json"))
        }
    }

    /// Update configuration from server-provided config
    pub fn update_from_server(&mut self, server_config: &ServerConfig) {
        if let Some(interval) = server_config.screenshot_interval {
            self.screenshot_interval = interval;
        }
        if let Some(interval) = server_config.activity_log_interval {
            self.activity_log_interval = interval;
        }
        if let Some(size) = server_config.keystroke_buffer_size {
            self.keystroke_buffer_size = size;
        }
    }
}

/// Configuration received from server after authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub screenshot_interval: Option<u64>,
    pub activity_log_interval: Option<u64>,
    pub keystroke_buffer_size: Option<usize>,
}

/// Configuration errors
#[derive(Debug)]
pub enum ConfigError {
    Io(String),
    Parse(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::Io(msg) => write!(f, "IO error: {}", msg),
            ConfigError::Parse(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for ConfigError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.server_url.is_empty());
        assert!(config.auto_start);
        assert_eq!(config.screenshot_interval, 5000);
        assert_eq!(config.heartbeat_interval, 10000);
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(config.screenshot_interval, parsed.screenshot_interval);
    }
}
