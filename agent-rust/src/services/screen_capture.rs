//! Screen capture service for screenshots and live streaming.
//!
//! Provides periodic screenshot capture and real-time screen streaming
//! capabilities for monitoring and remote viewing.

use crate::config::Config;
use crate::socket::SocketClient;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::codecs::jpeg::JpegEncoder;
use image::{ImageBuffer, Rgba};
use screenshots::Screen;
use std::io::Cursor;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Screen capture service
#[derive(Clone)]
pub struct ScreenCapture {
    socket: Arc<SocketClient>,
    config: Arc<RwLock<Config>>,
    is_capturing: Arc<RwLock<bool>>,
    is_streaming: Arc<RwLock<bool>>,
    stream_quality: Arc<RwLock<u32>>,
    stream_fps: Arc<RwLock<u32>>,
    capture_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    stream_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl ScreenCapture {
    /// Create a new screen capture service
    pub fn new(socket: Arc<SocketClient>, config: Arc<RwLock<Config>>) -> Self {
        Self {
            socket,
            config,
            is_capturing: Arc::new(RwLock::new(false)),
            is_streaming: Arc::new(RwLock::new(false)),
            stream_quality: Arc::new(RwLock::new(60)),
            stream_fps: Arc::new(RwLock::new(5)),
            capture_handle: Arc::new(RwLock::new(None)),
            stream_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start periodic screenshot capture
    pub async fn start(&self) {
        if *self.is_capturing.read().await {
            return;
        }

        *self.is_capturing.write().await = true;

        let socket = self.socket.clone();
        let config = self.config.clone();
        let is_capturing = self.is_capturing.clone();

        let handle = tokio::spawn(async move {
            info!("Screen capture service started");

            loop {
                if !*is_capturing.read().await {
                    break;
                }

                let interval = {
                    let cfg = config.read().await;
                    cfg.screenshot_interval
                };

                // Capture and send screenshot
                if let Err(e) = Self::capture_and_send_screenshot(&socket).await {
                    warn!("Failed to capture screenshot: {}", e);
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(interval)).await;
            }

            info!("Screen capture service stopped");
        });

        *self.capture_handle.write().await = Some(handle);
    }

    /// Stop periodic screenshot capture
    pub async fn stop(&self) {
        *self.is_capturing.write().await = false;

        if let Some(handle) = self.capture_handle.write().await.take() {
            handle.abort();
        }

        self.stop_stream().await;
    }

    /// Start live screen streaming
    pub async fn start_stream(&self, quality: u32, fps: u32) {
        // Stop existing stream if any
        self.stop_stream().await;

        *self.stream_quality.write().await = quality;
        *self.stream_fps.write().await = fps;
        *self.is_streaming.write().await = true;

        let socket = self.socket.clone();
        let is_streaming = self.is_streaming.clone();
        let stream_quality = self.stream_quality.clone();
        let stream_fps = self.stream_fps.clone();

        let handle = tokio::spawn(async move {
            info!("Screen streaming started: {}fps, {}% quality", fps, quality);

            loop {
                if !*is_streaming.read().await {
                    break;
                }

                let fps = *stream_fps.read().await;
                let quality = *stream_quality.read().await;
                let interval = 1000 / fps.max(1);

                // Capture and send frame
                if let Err(e) = Self::capture_and_send_frame(&socket, quality).await {
                    warn!("Failed to capture frame: {}", e);
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(interval as u64)).await;
            }

            info!("Screen streaming stopped");
        });

        *self.stream_handle.write().await = Some(handle);
    }

    /// Stop live screen streaming
    pub async fn stop_stream(&self) {
        *self.is_streaming.write().await = false;

        if let Some(handle) = self.stream_handle.write().await.take() {
            handle.abort();
        }
    }

    /// Capture and send a single screenshot
    pub async fn capture_and_send(&self) {
        if let Err(e) = Self::capture_and_send_screenshot(&self.socket).await {
            error!("Failed to capture screenshot: {}", e);
        }
    }

    /// Internal method to capture and send screenshot
    async fn capture_and_send_screenshot(socket: &SocketClient) -> Result<(), CaptureError> {
        let screens = Screen::all().map_err(|e| CaptureError::ScreenList(e.to_string()))?;

        if screens.is_empty() {
            return Err(CaptureError::NoScreens);
        }

        // Capture primary screen
        let screen = &screens[0];
        let image = screen
            .capture()
            .map_err(|e| CaptureError::Capture(e.to_string()))?;

        // Get active window info
        let active_window = Self::get_active_window().unwrap_or_else(|| "Desktop".to_string());

        // Convert to JPEG and base64
        let base64_image = Self::rgba_image_to_base64_jpeg(image, 80)?;

        // Send to server
        socket
            .send_screenshot(base64_image, active_window)
            .await
            .map_err(|e| CaptureError::Send(e.to_string()))?;

        debug!("Screenshot sent");
        Ok(())
    }

    /// Internal method to capture and send a streaming frame
    async fn capture_and_send_frame(
        socket: &SocketClient,
        quality: u32,
    ) -> Result<(), CaptureError> {
        let screens = Screen::all().map_err(|e| CaptureError::ScreenList(e.to_string()))?;

        for (index, screen) in screens.iter().enumerate() {
            let image = screen
                .capture()
                .map_err(|e| CaptureError::Capture(e.to_string()))?;

            // Convert to JPEG with specified quality
            let base64_image = Self::rgba_image_to_base64_jpeg(image, quality as u8)?;

            // Send frame
            socket
                .send_screen_frame(base64_image, index as u32)
                .await
                .map_err(|e| CaptureError::Send(e.to_string()))?;
        }

        Ok(())
    }

    /// Convert RgbaImage to base64-encoded JPEG
    fn rgba_image_to_base64_jpeg(
        image: ImageBuffer<Rgba<u8>, Vec<u8>>,
        quality: u8,
    ) -> Result<String, CaptureError> {
        // Convert to RGB (JPEG doesn't support alpha)
        let rgb_img = image::DynamicImage::ImageRgba8(image).to_rgb8();

        // Encode as JPEG
        let mut buffer = Cursor::new(Vec::new());
        let encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
        rgb_img
            .write_with_encoder(encoder)
            .map_err(|e| CaptureError::Encoding(e.to_string()))?;

        // Base64 encode
        let base64 = BASE64.encode(buffer.into_inner());

        Ok(base64)
    }

    /// Get active window title
    fn get_active_window() -> Option<String> {
        #[cfg(target_os = "macos")]
        {
            // Use AppleScript to get active window on macOS
            if let Ok(output) = std::process::Command::new("osascript")
                .args([
                    "-e",
                    r#"tell application "System Events"
                        set frontApp to name of first application process whose frontmost is true
                        set frontWindow to ""
                        try
                            tell application process frontApp
                                set frontWindow to name of front window
                            end tell
                        end try
                        return frontApp & " - " & frontWindow
                    end tell"#,
                ])
                .output()
            {
                if output.status.success() {
                    let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !title.is_empty() {
                        return Some(title);
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            // Windows active window detection would use Windows API
            // For now, return None and let the caller use default
        }

        #[cfg(target_os = "linux")]
        {
            // Linux active window detection would use X11 or Wayland APIs
            // For now, return None
        }

        None
    }

    /// Check if currently streaming
    pub async fn is_streaming(&self) -> bool {
        *self.is_streaming.read().await
    }

    /// Capture all monitors and return as base64 images
    pub async fn capture_all_monitors(&self) -> Result<Vec<(u32, String)>, CaptureError> {
        let screens = Screen::all().map_err(|e| CaptureError::ScreenList(e.to_string()))?;
        let mut captures = Vec::new();

        for (index, screen) in screens.iter().enumerate() {
            let image = screen
                .capture()
                .map_err(|e| CaptureError::Capture(e.to_string()))?;

            let base64_image = Self::rgba_image_to_base64_jpeg(image, 80)?;
            captures.push((index as u32, base64_image));
        }

        Ok(captures)
    }
}

/// Screen capture errors
#[derive(Debug)]
pub enum CaptureError {
    ScreenList(String),
    NoScreens,
    Capture(String),
    Conversion(String),
    Encoding(String),
    Send(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::ScreenList(msg) => write!(f, "Failed to list screens: {}", msg),
            CaptureError::NoScreens => write!(f, "No screens available"),
            CaptureError::Capture(msg) => write!(f, "Screen capture failed: {}", msg),
            CaptureError::Conversion(msg) => write!(f, "Image conversion failed: {}", msg),
            CaptureError::Encoding(msg) => write!(f, "Image encoding failed: {}", msg),
            CaptureError::Send(msg) => write!(f, "Failed to send: {}", msg),
        }
    }
}

impl std::error::Error for CaptureError {}
