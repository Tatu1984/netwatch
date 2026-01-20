//! Process monitoring service.
//!
//! Monitors running processes and reports them to the server.

use crate::socket::events::ProcessInfo;
use crate::socket::SocketClient;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Process monitoring service
#[derive(Clone)]
pub struct ProcessMonitor {
    socket: Arc<SocketClient>,
    is_running: Arc<RwLock<bool>>,
    monitor_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl ProcessMonitor {
    /// Create a new process monitor
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            is_running: Arc::new(RwLock::new(false)),
            monitor_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start process monitoring
    pub async fn start(&self) {
        if *self.is_running.read().await {
            return;
        }

        *self.is_running.write().await = true;

        let socket = self.socket.clone();
        let is_running = self.is_running.clone();

        let handle = tokio::spawn(async move {
            info!("Process monitor started");

            let mut sys = System::new_all();

            loop {
                if !*is_running.read().await {
                    break;
                }

                // Refresh process list
                sys.refresh_processes();

                // Collect process information
                let processes = Self::collect_processes(&sys);

                // Send to server
                if let Err(e) = socket.send_process_list(processes).await {
                    warn!("Failed to send process list: {}", e);
                } else {
                    debug!("Process list sent");
                }

                // Poll every 10 seconds
                tokio::time::sleep(Duration::from_secs(10)).await;
            }

            info!("Process monitor stopped");
        });

        *self.monitor_handle.write().await = Some(handle);
    }

    /// Stop process monitoring
    pub async fn stop(&self) {
        *self.is_running.write().await = false;

        if let Some(handle) = self.monitor_handle.write().await.take() {
            handle.abort();
        }
    }

    /// Collect process information
    fn collect_processes(sys: &System) -> Vec<ProcessInfo> {
        sys.processes()
            .iter()
            .map(|(pid, process)| {
                let user_id = process.user_id();
                let username = user_id
                    .map(|uid| uid.to_string())
                    .unwrap_or_else(|| "Unknown".to_string());

                ProcessInfo {
                    process_name: process.name().to_string(),
                    process_id: pid.as_u32(),
                    path: process
                        .exe()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    cpu_usage: process.cpu_usage() as f64,
                    memory_usage: process.memory(),
                    username,
                    started_at: Some(process.start_time() * 1000),
                }
            })
            .collect()
    }

    /// Get current process list (one-time)
    pub async fn get_processes(&self) -> Vec<ProcessInfo> {
        let mut sys = System::new_all();
        sys.refresh_processes();
        Self::collect_processes(&sys)
    }

    /// Check if running
    pub async fn is_active(&self) -> bool {
        *self.is_running.read().await
    }
}
