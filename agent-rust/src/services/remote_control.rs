//! Remote control service for mouse and keyboard simulation.
//!
//! Allows remote control of the computer by simulating
//! mouse movements, clicks, and keyboard input.

use crate::socket::events::{
    KeyboardEvent, MouseEvent, RemoteInputPayload, StartRemoteControlPayload,
};
use crate::socket::SocketClient;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Remote control service
#[derive(Clone)]
pub struct RemoteControl {
    socket: Arc<SocketClient>,
    is_active: Arc<RwLock<bool>>,
    session_id: Arc<RwLock<Option<String>>>,
}

impl RemoteControl {
    /// Create a new remote control service
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            is_active: Arc::new(RwLock::new(false)),
            session_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Register event handlers with the socket
    pub async fn register_handlers(&self, socket: &SocketClient) {
        // Start remote control handler
        let is_active = self.is_active.clone();
        let session_id = self.session_id.clone();

        socket
            .on_start_remote_control(move |data: StartRemoteControlPayload| {
                let is_active = is_active.clone();
                let session_id = session_id.clone();

                tokio::spawn(async move {
                    info!(
                        "Starting remote control session: {} (mode: {})",
                        data.session_id, data.mode
                    );
                    *session_id.write().await = Some(data.session_id);
                    *is_active.write().await = data.mode == "CONTROL";
                });
            })
            .await;

        // Remote input handler
        let is_active_input = self.is_active.clone();

        socket
            .on_remote_input(move |data: RemoteInputPayload| {
                let is_active = is_active_input.clone();

                tokio::spawn(async move {
                    if *is_active.read().await {
                        Self::handle_input_sync(data);
                    }
                });
            })
            .await;

        info!("Remote control handlers registered");
    }

    /// Handle remote input synchronously (runs in blocking task)
    fn handle_input_sync(data: RemoteInputPayload) {
        // Use std::thread::spawn for blocking input simulation
        std::thread::spawn(move || {
            use enigo::{Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};

            let mut enigo = match Enigo::new(&Settings::default()) {
                Ok(e) => e,
                Err(e) => {
                    warn!("Failed to initialize input simulator: {}", e);
                    return;
                }
            };

            match data.input_type.as_str() {
                "mouse" => {
                    if let Ok(event) = serde_json::from_value::<MouseEvent>(data.event) {
                        Self::handle_mouse_event(&mut enigo, event);
                    }
                }
                "keyboard" => {
                    if let Ok(event) = serde_json::from_value::<KeyboardEvent>(data.event) {
                        Self::handle_keyboard_event(&mut enigo, event);
                    }
                }
                _ => {
                    warn!("Unknown input type: {}", data.input_type);
                }
            }
        });
    }

    /// Handle mouse events
    fn handle_mouse_event(enigo: &mut enigo::Enigo, event: MouseEvent) {
        use enigo::{Axis, Button, Coordinate, Direction, Mouse};

        match event.event_type.as_str() {
            "move" => {
                let _ = enigo.move_mouse(event.x, event.y, Coordinate::Abs);
            }
            "click" => {
                let _ = enigo.move_mouse(event.x, event.y, Coordinate::Abs);

                let button = match event.button.as_deref() {
                    Some("right") => Button::Right,
                    Some("middle") => Button::Middle,
                    _ => Button::Left,
                };

                let _ = enigo.button(button, Direction::Click);

                if event.click_type.as_deref() == Some("double") {
                    let _ = enigo.button(button, Direction::Click);
                }
            }
            "scroll" => {
                if let Some(scroll_y) = event.scroll_y {
                    let _ = enigo.scroll(scroll_y, Axis::Vertical);
                }
                if let Some(scroll_x) = event.scroll_x {
                    let _ = enigo.scroll(scroll_x, Axis::Horizontal);
                }
            }
            "drag" => {
                use enigo::Button;
                let _ = enigo.button(Button::Left, Direction::Press);
                let _ = enigo.move_mouse(event.x, event.y, Coordinate::Abs);
                let _ = enigo.button(Button::Left, Direction::Release);
            }
            _ => {}
        }
    }

    /// Handle keyboard events
    fn handle_keyboard_event(enigo: &mut enigo::Enigo, event: KeyboardEvent) {
        use enigo::{Direction, Key, Keyboard};

        match event.event_type.as_str() {
            "keydown" => {
                if let Some(key) = event.key.as_ref() {
                    if let Some(enigo_key) = Self::map_key(key) {
                        let _ = enigo.key(enigo_key, Direction::Press);
                    }
                }
            }
            "keyup" => {
                if let Some(key) = event.key.as_ref() {
                    if let Some(enigo_key) = Self::map_key(key) {
                        let _ = enigo.key(enigo_key, Direction::Release);
                    }
                }
            }
            "type" => {
                if let Some(text) = event.text.as_ref() {
                    let _ = enigo.text(text);
                }
            }
            _ => {}
        }
    }

    /// Map key string to enigo Key
    fn map_key(key: &str) -> Option<enigo::Key> {
        use enigo::Key;

        if key.len() == 1 {
            return Some(Key::Unicode(key.chars().next().unwrap()));
        }

        match key.to_lowercase().as_str() {
            "enter" | "return" => Some(Key::Return),
            "tab" => Some(Key::Tab),
            "backspace" => Some(Key::Backspace),
            "delete" => Some(Key::Delete),
            "escape" | "esc" => Some(Key::Escape),
            "space" => Some(Key::Space),
            "arrowleft" | "left" => Some(Key::LeftArrow),
            "arrowright" | "right" => Some(Key::RightArrow),
            "arrowup" | "up" => Some(Key::UpArrow),
            "arrowdown" | "down" => Some(Key::DownArrow),
            "home" => Some(Key::Home),
            "end" => Some(Key::End),
            "pageup" => Some(Key::PageUp),
            "pagedown" => Some(Key::PageDown),
            "f1" => Some(Key::F1),
            "f2" => Some(Key::F2),
            "f3" => Some(Key::F3),
            "f4" => Some(Key::F4),
            "f5" => Some(Key::F5),
            "f6" => Some(Key::F6),
            "f7" => Some(Key::F7),
            "f8" => Some(Key::F8),
            "f9" => Some(Key::F9),
            "f10" => Some(Key::F10),
            "f11" => Some(Key::F11),
            "f12" => Some(Key::F12),
            _ => None,
        }
    }

    /// Stop the remote control session
    pub async fn stop_session(&self) {
        *self.is_active.write().await = false;
        *self.session_id.write().await = None;
        info!("Remote control session ended");
    }

    /// Check if session is active
    pub async fn is_session_active(&self) -> bool {
        *self.is_active.read().await
    }
}
