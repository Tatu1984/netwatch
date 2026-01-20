//! NetWatch Agent Library
//!
//! This library provides the core functionality for the NetWatch monitoring agent.
//! It includes modules for configuration management, socket communication,
//! monitoring services, and platform-specific implementations.

pub mod config;
pub mod platform;
pub mod services;
pub mod socket;
pub mod utils;

/// Agent version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
