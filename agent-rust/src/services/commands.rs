//! System commands service.
//!
//! Handles system-level commands like lock, shutdown, restart,
//! and executing arbitrary commands.

use crate::socket::events::CommandPayload;
use crate::socket::SocketClient;
use std::process::Command;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

/// Commands service
#[derive(Clone)]
pub struct Commands {
    socket: Arc<SocketClient>,
}

impl Commands {
    /// Create a new commands service
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self { socket }
    }

    /// Register event handlers with the socket
    pub async fn register_handlers(&self, socket: &SocketClient) {
        let socket_clone = self.socket.clone();

        socket
            .on_command(move |data: CommandPayload| {
                let socket = socket_clone.clone();

                tokio::spawn(async move {
                    Self::execute_command(&socket, data).await;
                });
            })
            .await;

        info!("Command handlers registered");
    }

    /// Execute a command
    async fn execute_command(socket: &SocketClient, data: CommandPayload) {
        info!("Executing command: {}", data.command);

        let (success, response, error) = match data.command.as_str() {
            "LOCK" => Self::lock_screen().await,
            "UNLOCK" => (
                true,
                Some("Unlock command received (requires user interaction)".to_string()),
                None,
            ),
            "SHUTDOWN" => Self::shutdown().await,
            "RESTART" => Self::restart().await,
            "LOGOFF" => Self::logoff().await,
            "SLEEP" => Self::sleep().await,
            "MESSAGE" => {
                let message = data
                    .payload
                    .as_ref()
                    .and_then(|p| p.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("No message");
                let title = data
                    .payload
                    .as_ref()
                    .and_then(|p| p.get("title"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("Message");
                Self::show_message(title, message).await
            }
            "EXECUTE" => {
                let cmd = data
                    .payload
                    .as_ref()
                    .and_then(|p| p.get("command"))
                    .and_then(|c| c.as_str());
                match cmd {
                    Some(c) => Self::execute_system_command(c).await,
                    None => (false, None, Some("No command provided".to_string())),
                }
            }
            "KILL_PROCESS" => {
                let pid = data
                    .payload
                    .as_ref()
                    .and_then(|p| p.get("processId"))
                    .and_then(|p| p.as_u64())
                    .map(|p| p as u32);
                match pid {
                    Some(p) => Self::kill_process(p).await,
                    None => (false, None, Some("No process ID provided".to_string())),
                }
            }
            _ => (
                false,
                None,
                Some(format!("Unknown command: {}", data.command)),
            ),
        };

        if let Err(e) = socket
            .send_command_response(data.id, success, response, error)
            .await
        {
            error!("Failed to send command response: {}", e);
        }
    }

    /// Lock the screen
    async fn lock_screen() -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("rundll32.exe")
                    .args(["user32.dll,LockWorkStation"])
                    .spawn()
            }

            #[cfg(target_os = "macos")]
            {
                Command::new("osascript")
                    .args([
                        "-e",
                        r#"tell application "System Events" to keystroke "q" using {control down, command down}"#,
                    ])
                    .spawn()
            }

            #[cfg(target_os = "linux")]
            {
                // Try different lock commands
                Command::new("loginctl").args(["lock-session"]).spawn()
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "Platform not supported",
                ))
            }
        };

        match result {
            Ok(_) => (true, Some("Screen locked".to_string()), None),
            Err(e) => (false, None, Some(format!("Failed to lock screen: {}", e))),
        }
    }

    /// Shutdown the system
    async fn shutdown() -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("shutdown")
                    .args(["/s", "/t", "30", "/c", "Remote shutdown initiated"])
                    .spawn()
            }

            #[cfg(target_os = "macos")]
            {
                Command::new("osascript")
                    .args(["-e", r#"tell app "System Events" to shut down"#])
                    .spawn()
            }

            #[cfg(target_os = "linux")]
            {
                Command::new("shutdown")
                    .args(["-h", "+1", "Remote shutdown initiated"])
                    .spawn()
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "Platform not supported",
                ))
            }
        };

        match result {
            Ok(_) => (true, Some("Shutdown initiated".to_string()), None),
            Err(e) => (false, None, Some(format!("Failed to shutdown: {}", e))),
        }
    }

    /// Restart the system
    async fn restart() -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("shutdown")
                    .args(["/r", "/t", "30", "/c", "Remote restart initiated"])
                    .spawn()
            }

            #[cfg(target_os = "macos")]
            {
                Command::new("osascript")
                    .args(["-e", r#"tell app "System Events" to restart"#])
                    .spawn()
            }

            #[cfg(target_os = "linux")]
            {
                Command::new("shutdown")
                    .args(["-r", "+1", "Remote restart initiated"])
                    .spawn()
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "Platform not supported",
                ))
            }
        };

        match result {
            Ok(_) => (true, Some("Restart initiated".to_string()), None),
            Err(e) => (false, None, Some(format!("Failed to restart: {}", e))),
        }
    }

    /// Log off the current user
    async fn logoff() -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("shutdown").args(["/l"]).spawn()
            }

            #[cfg(target_os = "macos")]
            {
                Command::new("osascript")
                    .args(["-e", r#"tell app "System Events" to log out"#])
                    .spawn()
            }

            #[cfg(target_os = "linux")]
            {
                Command::new("gnome-session-quit")
                    .args(["--logout", "--no-prompt"])
                    .spawn()
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "Platform not supported",
                ))
            }
        };

        match result {
            Ok(_) => (true, Some("Logoff initiated".to_string()), None),
            Err(e) => (false, None, Some(format!("Failed to logoff: {}", e))),
        }
    }

    /// Put the system to sleep
    async fn sleep() -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("rundll32.exe")
                    .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                    .spawn()
            }

            #[cfg(target_os = "macos")]
            {
                Command::new("pmset").args(["sleepnow"]).spawn()
            }

            #[cfg(target_os = "linux")]
            {
                Command::new("systemctl").args(["suspend"]).spawn()
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "Platform not supported",
                ))
            }
        };

        match result {
            Ok(_) => (true, Some("Sleep initiated".to_string()), None),
            Err(e) => (false, None, Some(format!("Failed to sleep: {}", e))),
        }
    }

    /// Show a message to the user
    async fn show_message(title: &str, message: &str) -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "macos")]
            {
                let script = format!(
                    r#"display dialog "{}" with title "{}" buttons {{"OK"}} default button "OK""#,
                    message.replace('"', "\\\""),
                    title.replace('"', "\\\"")
                );
                Command::new("osascript").args(["-e", &script]).spawn()
            }

            #[cfg(target_os = "windows")]
            {
                let script = format!(
                    r#"Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{}', '{}')"#,
                    message.replace('\'', "''"),
                    title.replace('\'', "''")
                );
                Command::new("powershell")
                    .args(["-Command", &script])
                    .spawn()
            }

            #[cfg(target_os = "linux")]
            {
                // Try zenity, then kdialog, then notify-send
                Command::new("zenity")
                    .args(["--info", "--title", title, "--text", message])
                    .spawn()
                    .or_else(|_| {
                        Command::new("kdialog")
                            .args(["--msgbox", message, "--title", title])
                            .spawn()
                    })
                    .or_else(|_| {
                        Command::new("notify-send")
                            .args([title, message])
                            .spawn()
                    })
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "Platform not supported",
                ))
            }
        };

        match result {
            Ok(_) => (true, Some("Message displayed".to_string()), None),
            Err(e) => (
                false,
                None,
                Some(format!("Failed to show message: {}", e)),
            ),
        }
    }

    /// Execute a system command
    async fn execute_system_command(command: &str) -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd").args(["/C", command]).output()
            }

            #[cfg(not(target_os = "windows"))]
            {
                Command::new("sh").args(["-c", command]).output()
            }
        };

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                if output.status.success() {
                    (
                        true,
                        Some(if stdout.is_empty() {
                            "Command executed successfully".to_string()
                        } else {
                            stdout
                        }),
                        None,
                    )
                } else {
                    (
                        false,
                        Some(stdout),
                        Some(if stderr.is_empty() {
                            format!("Command failed with exit code: {:?}", output.status.code())
                        } else {
                            stderr
                        }),
                    )
                }
            }
            Err(e) => (
                false,
                None,
                Some(format!("Failed to execute command: {}", e)),
            ),
        }
    }

    /// Kill a process by PID
    async fn kill_process(pid: u32) -> (bool, Option<String>, Option<String>) {
        let result = {
            #[cfg(target_os = "windows")]
            {
                Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F"])
                    .output()
            }

            #[cfg(not(target_os = "windows"))]
            {
                Command::new("kill").args(["-9", &pid.to_string()]).output()
            }
        };

        match result {
            Ok(output) => {
                if output.status.success() {
                    (
                        true,
                        Some(format!("Process {} terminated", pid)),
                        None,
                    )
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    (
                        false,
                        None,
                        Some(format!("Failed to kill process: {}", stderr)),
                    )
                }
            }
            Err(e) => (
                false,
                None,
                Some(format!("Failed to kill process: {}", e)),
            ),
        }
    }
}
