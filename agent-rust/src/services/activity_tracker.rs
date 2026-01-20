//! Activity tracker service for monitoring active windows and applications.
//!
//! Tracks which applications and windows the user is interacting with,
//! categorizes them, and reports activity logs to the server.

use crate::socket::events::ActivityLogEntry;
use crate::socket::SocketClient;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Application categories mapping
lazy_static::lazy_static! {
    static ref APP_CATEGORIES: HashMap<&'static str, &'static str> = {
        let mut m = HashMap::new();
        // Browsers
        m.insert("chrome", "BROWSER");
        m.insert("firefox", "BROWSER");
        m.insert("safari", "BROWSER");
        m.insert("edge", "BROWSER");
        m.insert("opera", "BROWSER");
        m.insert("brave", "BROWSER");

        // Communication
        m.insert("slack", "COMMUNICATION");
        m.insert("teams", "COMMUNICATION");
        m.insert("zoom", "COMMUNICATION");
        m.insert("discord", "COMMUNICATION");
        m.insert("skype", "COMMUNICATION");
        m.insert("outlook", "COMMUNICATION");
        m.insert("mail", "COMMUNICATION");
        m.insert("thunderbird", "COMMUNICATION");

        // Productivity
        m.insert("word", "PRODUCTIVITY");
        m.insert("excel", "PRODUCTIVITY");
        m.insert("powerpoint", "PRODUCTIVITY");
        m.insert("pages", "PRODUCTIVITY");
        m.insert("numbers", "PRODUCTIVITY");
        m.insert("keynote", "PRODUCTIVITY");
        m.insert("notion", "PRODUCTIVITY");
        m.insert("evernote", "PRODUCTIVITY");
        m.insert("onenote", "PRODUCTIVITY");

        // Development
        m.insert("code", "DEVELOPMENT");
        m.insert("vscode", "DEVELOPMENT");
        m.insert("visual studio", "DEVELOPMENT");
        m.insert("intellij", "DEVELOPMENT");
        m.insert("pycharm", "DEVELOPMENT");
        m.insert("webstorm", "DEVELOPMENT");
        m.insert("xcode", "DEVELOPMENT");
        m.insert("android studio", "DEVELOPMENT");
        m.insert("sublime", "DEVELOPMENT");
        m.insert("atom", "DEVELOPMENT");
        m.insert("terminal", "DEVELOPMENT");
        m.insert("iterm", "DEVELOPMENT");
        m.insert("powershell", "DEVELOPMENT");
        m.insert("cmd", "DEVELOPMENT");

        // Entertainment
        m.insert("spotify", "ENTERTAINMENT");
        m.insert("netflix", "ENTERTAINMENT");
        m.insert("youtube", "ENTERTAINMENT");
        m.insert("vlc", "ENTERTAINMENT");
        m.insert("music", "ENTERTAINMENT");

        // Social
        m.insert("facebook", "SOCIAL");
        m.insert("twitter", "SOCIAL");
        m.insert("instagram", "SOCIAL");
        m.insert("linkedin", "SOCIAL");
        m.insert("reddit", "SOCIAL");

        // File Management
        m.insert("finder", "FILE_MANAGEMENT");
        m.insert("explorer", "FILE_MANAGEMENT");
        m.insert("files", "FILE_MANAGEMENT");

        // System
        m.insert("settings", "SYSTEM");
        m.insert("control panel", "SYSTEM");
        m.insert("system preferences", "SYSTEM");

        m
    };
}

/// Current activity being tracked
#[derive(Debug, Clone)]
struct CurrentActivity {
    application_name: String,
    window_title: String,
    start_time: u64,
    category: Option<String>,
}

/// Activity tracker service
#[derive(Clone)]
pub struct ActivityTracker {
    socket: Arc<SocketClient>,
    is_running: Arc<RwLock<bool>>,
    current_activity: Arc<RwLock<Option<CurrentActivity>>>,
    activity_buffer: Arc<RwLock<Vec<ActivityLogEntry>>>,
    last_input_time: Arc<RwLock<Instant>>,
    track_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    flush_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl ActivityTracker {
    /// Create a new activity tracker
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            is_running: Arc::new(RwLock::new(false)),
            current_activity: Arc::new(RwLock::new(None)),
            activity_buffer: Arc::new(RwLock::new(Vec::new())),
            last_input_time: Arc::new(RwLock::new(Instant::now())),
            track_handle: Arc::new(RwLock::new(None)),
            flush_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start activity tracking
    pub async fn start(&self) {
        if *self.is_running.read().await {
            return;
        }

        *self.is_running.write().await = true;

        // Start tracking task
        let socket = self.socket.clone();
        let is_running = self.is_running.clone();
        let current_activity = self.current_activity.clone();
        let activity_buffer = self.activity_buffer.clone();

        let track_handle = tokio::spawn(async move {
            info!("Activity tracker started");

            loop {
                if !*is_running.read().await {
                    break;
                }

                // Track active window
                Self::track_active_window(&current_activity, &activity_buffer).await;

                // Check every second
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });

        *self.track_handle.write().await = Some(track_handle);

        // Start flush task
        let socket_flush = self.socket.clone();
        let is_running_flush = self.is_running.clone();
        let activity_buffer_flush = self.activity_buffer.clone();
        let current_activity_flush = self.current_activity.clone();

        let flush_handle = tokio::spawn(async move {
            loop {
                if !*is_running_flush.read().await {
                    break;
                }

                // Flush every 30 seconds
                tokio::time::sleep(Duration::from_secs(30)).await;

                Self::flush_buffer(
                    &socket_flush,
                    &current_activity_flush,
                    &activity_buffer_flush,
                )
                .await;
            }
        });

        *self.flush_handle.write().await = Some(flush_handle);
    }

    /// Stop activity tracking
    pub async fn stop(&self) {
        *self.is_running.write().await = false;

        // Commit current activity
        Self::commit_current_activity(&self.current_activity, &self.activity_buffer).await;

        // Flush remaining buffer
        Self::flush_buffer(&self.socket, &self.current_activity, &self.activity_buffer).await;

        if let Some(handle) = self.track_handle.write().await.take() {
            handle.abort();
        }

        if let Some(handle) = self.flush_handle.write().await.take() {
            handle.abort();
        }

        info!("Activity tracker stopped");
    }

    /// Track the currently active window
    async fn track_active_window(
        current_activity: &Arc<RwLock<Option<CurrentActivity>>>,
        activity_buffer: &Arc<RwLock<Vec<ActivityLogEntry>>>,
    ) {
        let (app_name, window_title) = Self::get_active_window_info();

        let mut activity = current_activity.write().await;

        // Check if activity changed
        if let Some(ref current) = *activity {
            if current.application_name == app_name && current.window_title == window_title {
                // Same activity, nothing to do
                return;
            }

            // Activity changed, commit previous
            let now = Self::timestamp();
            let duration = now - current.start_time;

            if duration > 1000 {
                // Only commit if lasted more than 1 second
                let entry = ActivityLogEntry {
                    application_name: current.application_name.clone(),
                    window_title: current.window_title.clone(),
                    start_time: current.start_time,
                    end_time: now,
                    duration,
                    category: current.category.clone(),
                };

                activity_buffer.write().await.push(entry);
                debug!(
                    "Activity committed: {} - {} ({}ms)",
                    current.application_name, current.window_title, duration
                );
            }
        }

        // Start new activity
        let category = Self::categorize_app(&app_name);
        *activity = Some(CurrentActivity {
            application_name: app_name,
            window_title,
            start_time: Self::timestamp(),
            category,
        });
    }

    /// Commit the current activity to the buffer
    async fn commit_current_activity(
        current_activity: &Arc<RwLock<Option<CurrentActivity>>>,
        activity_buffer: &Arc<RwLock<Vec<ActivityLogEntry>>>,
    ) {
        let mut activity = current_activity.write().await;

        if let Some(current) = activity.take() {
            let now = Self::timestamp();
            let duration = now - current.start_time;

            if duration > 1000 {
                let entry = ActivityLogEntry {
                    application_name: current.application_name,
                    window_title: current.window_title,
                    start_time: current.start_time,
                    end_time: now,
                    duration,
                    category: current.category,
                };

                activity_buffer.write().await.push(entry);
            }
        }
    }

    /// Flush the activity buffer to the server
    async fn flush_buffer(
        socket: &SocketClient,
        current_activity: &Arc<RwLock<Option<CurrentActivity>>>,
        activity_buffer: &Arc<RwLock<Vec<ActivityLogEntry>>>,
    ) {
        let mut buffer = activity_buffer.write().await;

        if buffer.is_empty() {
            return;
        }

        let logs: Vec<ActivityLogEntry> = buffer.drain(..).collect();
        let count = logs.len();

        if let Err(e) = socket.send_activity_logs(logs).await {
            warn!("Failed to send activity logs: {}", e);
        } else {
            debug!("Flushed {} activity entries", count);
        }
    }

    /// Get active window information (app name, window title)
    fn get_active_window_info() -> (String, String) {
        #[cfg(target_os = "macos")]
        {
            if let Some((app, title)) = Self::get_macos_active_window() {
                return (app, title);
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Some((app, title)) = Self::get_windows_active_window() {
                return (app, title);
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Some((app, title)) = Self::get_linux_active_window() {
                return (app, title);
            }
        }

        ("Unknown".to_string(), "Unknown".to_string())
    }

    #[cfg(target_os = "macos")]
    fn get_macos_active_window() -> Option<(String, String)> {
        let script = r#"
            tell application "System Events"
                set frontApp to name of first application process whose frontmost is true
                set frontWindow to ""
                try
                    tell application process frontApp
                        set frontWindow to name of front window
                    end tell
                end try
                return frontApp & "|" & frontWindow
            end tell
        "#;

        if let Ok(output) = std::process::Command::new("osascript")
            .args(["-e", script])
            .output()
        {
            if output.status.success() {
                let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let parts: Vec<&str> = result.splitn(2, '|').collect();
                if parts.len() == 2 {
                    return Some((parts[0].to_string(), parts[1].to_string()));
                }
            }
        }
        None
    }

    #[cfg(target_os = "windows")]
    fn get_windows_active_window() -> Option<(String, String)> {
        // Windows implementation would use Windows API
        // For now, return None
        None
    }

    #[cfg(target_os = "linux")]
    fn get_linux_active_window() -> Option<(String, String)> {
        // Try using xdotool for X11
        if let Ok(output) = std::process::Command::new("xdotool")
            .args(["getactivewindow", "getwindowname"])
            .output()
        {
            if output.status.success() {
                let title = String::from_utf8_lossy(&output.stdout).trim().to_string();

                // Try to get the app name
                if let Ok(pid_output) = std::process::Command::new("xdotool")
                    .args(["getactivewindow", "getwindowpid"])
                    .output()
                {
                    if pid_output.status.success() {
                        let pid = String::from_utf8_lossy(&pid_output.stdout)
                            .trim()
                            .to_string();
                        if let Ok(comm_output) = std::process::Command::new("ps")
                            .args(["-p", &pid, "-o", "comm="])
                            .output()
                        {
                            if comm_output.status.success() {
                                let app =
                                    String::from_utf8_lossy(&comm_output.stdout).trim().to_string();
                                return Some((app, title));
                            }
                        }
                    }
                }

                return Some(("Unknown".to_string(), title));
            }
        }
        None
    }

    /// Categorize an application by name
    fn categorize_app(app_name: &str) -> Option<String> {
        let lower_name = app_name.to_lowercase();

        for (keyword, category) in APP_CATEGORIES.iter() {
            if lower_name.contains(keyword) {
                return Some(category.to_string());
            }
        }

        Some("OTHER".to_string())
    }

    /// Record input activity (for idle detection)
    pub async fn record_input_activity(&self) {
        *self.last_input_time.write().await = Instant::now();
    }

    /// Check if user is idle
    pub async fn is_idle(&self, threshold_ms: u64) -> bool {
        let last_input = *self.last_input_time.read().await;
        last_input.elapsed().as_millis() as u64 > threshold_ms
    }

    /// Get idle time in milliseconds
    pub async fn get_idle_time(&self) -> u64 {
        let last_input = *self.last_input_time.read().await;
        last_input.elapsed().as_millis() as u64
    }

    /// Get current timestamp in milliseconds
    fn timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}
