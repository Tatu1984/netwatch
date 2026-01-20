//! File transfer service for upload and download operations.
//!
//! Handles file transfers between the server and client,
//! including directory listing and file operations.

use crate::socket::events::{DirectoryEntry, FileTransferPayload, ListDirectoryPayload};
use crate::socket::SocketClient;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

/// Transfer information
#[derive(Debug, Clone)]
struct TransferInfo {
    transfer_id: String,
    direction: String,
    remote_path: String,
    progress: u32,
    bytes_transferred: u64,
    total_bytes: u64,
}

/// File transfer service
#[derive(Clone)]
pub struct FileTransfer {
    socket: Arc<SocketClient>,
    active_transfers: Arc<RwLock<HashMap<String, TransferInfo>>>,
}

impl FileTransfer {
    /// Create a new file transfer service
    pub fn new(socket: Arc<SocketClient>) -> Self {
        Self {
            socket,
            active_transfers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register event handlers with the socket
    pub async fn register_handlers(&self, socket: &SocketClient) {
        // File transfer handler
        let socket_clone = self.socket.clone();
        let transfers = self.active_transfers.clone();

        socket
            .on_file_transfer(move |data: FileTransferPayload| {
                let socket = socket_clone.clone();
                let transfers = transfers.clone();

                tokio::spawn(async move {
                    match data.direction.as_str() {
                        "DOWNLOAD" => {
                            Self::handle_download(&socket, &transfers, data).await;
                        }
                        "UPLOAD" => {
                            Self::handle_upload(&socket, &transfers, data).await;
                        }
                        _ => {
                            warn!("Unknown transfer direction: {}", data.direction);
                        }
                    }
                });
            })
            .await;

        // List directory handler
        let socket_list = self.socket.clone();

        socket
            .on_list_directory(move |data: ListDirectoryPayload| {
                let socket = socket_list.clone();

                tokio::spawn(async move {
                    Self::handle_list_directory(&socket, data).await;
                });
            })
            .await;

        info!("File transfer handlers registered");
    }

    /// Handle file download (server requests file from agent)
    async fn handle_download(
        socket: &SocketClient,
        transfers: &Arc<RwLock<HashMap<String, TransferInfo>>>,
        data: FileTransferPayload,
    ) {
        info!("Starting download: {}", data.remote_path);

        let path = Path::new(&data.remote_path);

        // Check if file exists
        if !path.exists() {
            error!("File not found: {}", data.remote_path);
            let _ = socket
                .send_command_response(
                    data.transfer_id.clone(),
                    false,
                    None,
                    Some(format!("File not found: {}", data.remote_path)),
                )
                .await;
            return;
        }

        // Check if it's a directory
        if path.is_dir() {
            error!("Cannot download directories: {}", data.remote_path);
            let _ = socket
                .send_command_response(
                    data.transfer_id.clone(),
                    false,
                    None,
                    Some("Cannot download directories".to_string()),
                )
                .await;
            return;
        }

        // Get file size
        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to get file metadata: {}", e);
                return;
            }
        };

        let total_bytes = metadata.len();

        // Create transfer info
        let transfer = TransferInfo {
            transfer_id: data.transfer_id.clone(),
            direction: "DOWNLOAD".to_string(),
            remote_path: data.remote_path.clone(),
            progress: 0,
            bytes_transferred: 0,
            total_bytes,
        };

        transfers.write().await.insert(data.transfer_id.clone(), transfer);

        // Read file content
        let content = match fs::read(path) {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to read file: {}", e);
                transfers.write().await.remove(&data.transfer_id);
                return;
            }
        };

        // Encode as base64
        let base64_content = BASE64.encode(&content);

        // Get file name
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        // Send file content
        if let Err(e) = socket
            .send_file_content(
                data.transfer_id.clone(),
                file_name,
                base64_content,
                total_bytes,
            )
            .await
        {
            error!("Failed to send file content: {}", e);
        }

        // Send progress (100%)
        let _ = socket
            .send_file_transfer_progress(data.transfer_id.clone(), 100, total_bytes)
            .await;

        // Remove transfer info
        transfers.write().await.remove(&data.transfer_id);

        info!(
            "Download complete: {} ({} bytes)",
            data.remote_path, total_bytes
        );
    }

    /// Handle file upload (server sends file to agent)
    async fn handle_upload(
        socket: &SocketClient,
        transfers: &Arc<RwLock<HashMap<String, TransferInfo>>>,
        data: FileTransferPayload,
    ) {
        info!("Starting upload to: {}", data.remote_path);

        let file_data = match data.file_data {
            Some(d) => d,
            None => {
                error!("No file data provided for upload");
                return;
            }
        };

        // Decode base64
        let content = match BASE64.decode(&file_data) {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to decode file data: {}", e);
                return;
            }
        };

        let total_bytes = content.len() as u64;

        // Create transfer info
        let transfer = TransferInfo {
            transfer_id: data.transfer_id.clone(),
            direction: "UPLOAD".to_string(),
            remote_path: data.remote_path.clone(),
            progress: 0,
            bytes_transferred: 0,
            total_bytes,
        };

        transfers.write().await.insert(data.transfer_id.clone(), transfer);

        // Ensure directory exists
        let path = Path::new(&data.remote_path);
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                if let Err(e) = fs::create_dir_all(parent) {
                    error!("Failed to create directory: {}", e);
                    transfers.write().await.remove(&data.transfer_id);
                    return;
                }
            }
        }

        // Write file
        if let Err(e) = fs::write(path, &content) {
            error!("Failed to write file: {}", e);
            transfers.write().await.remove(&data.transfer_id);
            return;
        }

        // Send progress (100%)
        let _ = socket
            .send_file_transfer_progress(data.transfer_id.clone(), 100, total_bytes)
            .await;

        // Remove transfer info
        transfers.write().await.remove(&data.transfer_id);

        info!(
            "Upload complete: {} ({} bytes)",
            data.remote_path, total_bytes
        );
    }

    /// Handle directory listing request
    async fn handle_list_directory(socket: &SocketClient, data: ListDirectoryPayload) {
        debug!("Listing directory: {}", data.path);

        let path = if data.path.is_empty() || data.path == "~" {
            dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"))
        } else {
            std::path::PathBuf::from(&data.path)
        };

        if !path.exists() {
            warn!("Directory not found: {:?}", path);
            return;
        }

        let entries: Vec<DirectoryEntry> = match fs::read_dir(&path) {
            Ok(entries) => entries
                .filter_map(|entry| {
                    let entry = entry.ok()?;
                    let metadata = entry.metadata().ok()?;
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);

                    Some(DirectoryEntry {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: entry.path().to_string_lossy().to_string(),
                        is_directory: metadata.is_dir(),
                        size: metadata.len(),
                        modified,
                    })
                })
                .collect(),
            Err(e) => {
                error!("Failed to read directory: {}", e);
                Vec::new()
            }
        };

        if let Err(e) = socket
            .send_directory_listing(path.to_string_lossy().to_string(), entries)
            .await
        {
            warn!("Failed to send directory listing: {}", e);
        }
    }

    /// Delete a file or directory
    pub fn delete(&self, path: &str) -> Result<(), std::io::Error> {
        let path = Path::new(path);

        if path.is_dir() {
            fs::remove_dir_all(path)
        } else {
            fs::remove_file(path)
        }
    }

    /// Create a directory
    pub fn create_directory(&self, path: &str) -> Result<(), std::io::Error> {
        fs::create_dir_all(path)
    }

    /// Rename/move a file or directory
    pub fn rename(&self, old_path: &str, new_path: &str) -> Result<(), std::io::Error> {
        fs::rename(old_path, new_path)
    }

    /// Get active transfers
    pub async fn get_active_transfers(&self) -> Vec<TransferInfo> {
        self.active_transfers.read().await.values().cloned().collect()
    }

    /// Cancel a transfer
    pub async fn cancel_transfer(&self, transfer_id: &str) {
        self.active_transfers.write().await.remove(transfer_id);
    }
}
