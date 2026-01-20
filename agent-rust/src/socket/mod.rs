//! Socket module for WebSocket communication with the server.
//!
//! This module provides the Socket.IO client wrapper and event handling
//! for communicating with the NetWatch server.

mod client;
pub mod events;

pub use client::SocketClient;
pub use events::*;
