//! Terminal service for remote shell sessions.
//!
//! Provides remote terminal access by spawning shell processes
//! and relaying input/output through the socket connection.

use crate::socket::events::{StartTerminalPayload, TerminalInputPayload};
use crate::socket::SocketClient;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{error, info, warn};

/// Terminal session (simplified using std::process)
struct TerminalSession {
    session_id: String,
    child: Child,
    stdin_tx: mpsc::Sender<String>,
}

/// Terminal service
#[derive(Clone)]
pub struct Terminal {
    socket: Arc<SocketClient>,
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl Terminal {
    /// Create a new terminal service
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register event handlers with the socket
    pub async fn register_handlers(&self, socket: &SocketClient) {
        // Start terminal handler
        let sessions = self.sessions.clone();
        let socket_clone = self.socket.clone();

        socket
            .on_start_terminal(move |data: StartTerminalPayload| {
                let sessions = sessions.clone();
                let socket = socket_clone.clone();

                tokio::spawn(async move {
                    Self::start_session_impl(sessions, socket, data).await;
                });
            })
            .await;

        // Terminal input handler
        let sessions_input = self.sessions.clone();

        socket
            .on_terminal_input(move |data: TerminalInputPayload| {
                let sessions = sessions_input.clone();

                tokio::spawn(async move {
                    Self::handle_input_impl(sessions, data).await;
                });
            })
            .await;

        info!("Terminal handlers registered");
    }

    /// Start a new terminal session
    async fn start_session_impl(
        sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
        socket: Arc<SocketClient>,
        data: StartTerminalPayload,
    ) {
        let shell = data.shell.unwrap_or_else(|| Self::get_default_shell());

        info!(
            "Starting terminal session {} with shell: {}",
            data.session_id, shell
        );

        // Spawn shell process
        let mut child = match Command::new(&shell)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to spawn shell: {}", e);
                let _ = socket
                    .send_terminal_output(
                        data.session_id.clone(),
                        format!("\r\n[Failed to start shell: {}]\r\n", e),
                    )
                    .await;
                return;
            }
        };

        // Create channel for stdin
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(100);

        // Get stdin handle
        let mut stdin = child.stdin.take().expect("Failed to get stdin");

        // Spawn stdin writer task
        tokio::spawn(async move {
            while let Some(input) = stdin_rx.recv().await {
                if stdin.write_all(input.as_bytes()).is_err() {
                    break;
                }
                let _ = stdin.flush();
            }
        });

        // Get stdout handle and spawn reader
        if let Some(stdout) = child.stdout.take() {
            let socket_stdout = socket.clone();
            let session_id_stdout = data.session_id.clone();

            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    match line {
                        Ok(line) => {
                            let socket = socket_stdout.clone();
                            let session_id = session_id_stdout.clone();
                            let output = format!("{}\r\n", line);

                            // Use tokio runtime to send
                            let rt = tokio::runtime::Handle::current();
                            rt.spawn(async move {
                                let _ = socket.send_terminal_output(session_id, output).await;
                            });
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // Get stderr handle and spawn reader
        if let Some(stderr) = child.stderr.take() {
            let socket_stderr = socket.clone();
            let session_id_stderr = data.session_id.clone();

            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    match line {
                        Ok(line) => {
                            let socket = socket_stderr.clone();
                            let session_id = session_id_stderr.clone();
                            let output = format!("{}\r\n", line);

                            let rt = tokio::runtime::Handle::current();
                            rt.spawn(async move {
                                let _ = socket.send_terminal_output(session_id, output).await;
                            });
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // Store session
        let session = TerminalSession {
            session_id: data.session_id.clone(),
            child,
            stdin_tx,
        };

        sessions.lock().await.insert(data.session_id.clone(), session);

        // Send welcome message
        let _ = socket
            .send_terminal_output(data.session_id, format!("Connected to {}\r\n", shell))
            .await;
    }

    /// Handle terminal input
    async fn handle_input_impl(
        sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
        data: TerminalInputPayload,
    ) {
        let sessions_guard = sessions.lock().await;
        if let Some(session) = sessions_guard.get(&data.session_id) {
            if session.stdin_tx.send(data.input).await.is_err() {
                warn!("Failed to send input to terminal: {}", data.session_id);
            }
        } else {
            warn!("Terminal session not found: {}", data.session_id);
        }
    }

    /// Get the default shell for the current platform
    fn get_default_shell() -> String {
        #[cfg(target_os = "windows")]
        {
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }

        #[cfg(target_os = "macos")]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
        }

        #[cfg(target_os = "linux")]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            "/bin/sh".to_string()
        }
    }

    /// Stop a specific terminal session
    pub async fn stop_session(&self, session_id: &str) {
        if let Some(mut session) = self.sessions.lock().await.remove(session_id) {
            let _ = session.child.kill();
            info!("Terminal session {} stopped", session_id);
        }
    }

    /// Stop all terminal sessions
    pub async fn stop_all(&self) {
        let mut sessions = self.sessions.lock().await;
        for (id, mut session) in sessions.drain() {
            let _ = session.child.kill();
            info!("Terminal session {} stopped", id);
        }
    }

    /// Get list of active session IDs
    pub async fn get_active_sessions(&self) -> Vec<String> {
        self.sessions.lock().await.keys().cloned().collect()
    }
}
