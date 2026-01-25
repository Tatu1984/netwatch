"use client";

import { io, Socket } from "socket.io-client";

let consoleSocket: Socket | null = null;

// Get socket server URL from environment or derive from window location
function getSocketUrl(): string {
  // Use explicit socket URL if configured
  const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (envSocketUrl && envSocketUrl !== "http://localhost:4000") {
    return envSocketUrl;
  }

  // In browser, check if we're on a production domain (not localhost)
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      // Production: use same origin
      return window.location.origin;
    }
  }

  // Development: use localhost socket server
  return "http://localhost:4000";
}

// Determine socket.io path based on environment
// Production (behind nginx/proxy) uses /nw-socket/socket.io
// Local development uses default /socket.io
function getSocketPath(): string {
  // Allow explicit path override via env var
  const envSocketPath = process.env.NEXT_PUBLIC_SOCKET_PATH;
  if (envSocketPath) {
    return envSocketPath;
  }

  // In browser, auto-detect based on hostname
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Production domains use /nw-socket path (behind nginx proxy)
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return "/nw-socket/socket.io";
    }
  }

  // Development: use default path
  return "/socket.io";
}

export function getConsoleSocket(): Socket {
  if (!consoleSocket) {
    const socketUrl = getSocketUrl();
    const socketPath = getSocketPath();

    console.log(`[Socket] Connecting to ${socketUrl} with path ${socketPath}`);

    consoleSocket = io(`${socketUrl}/console`, {
      path: socketPath,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["polling", "websocket"], // Allow polling fallback
    });
  }
  return consoleSocket;
}

export function connectConsole(userId: string): Promise<{ onlineAgents: Array<{ computerId: string }> }> {
  const socket = getConsoleSocket();

  return new Promise((resolve, reject) => {
    if (socket.connected) {
      socket.emit("auth", { userId });
    }

    socket.connect();

    socket.on("connect", () => {
      socket.emit("auth", { userId });
    });

    socket.on("auth_success", (data) => {
      resolve(data);
    });

    socket.on("connect_error", (error) => {
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!socket.connected) {
        reject(new Error("Connection timeout"));
      }
    }, 10000);
  });
}

export function disconnectConsole() {
  if (consoleSocket) {
    consoleSocket.disconnect();
    consoleSocket = null;
  }
}

// Event types for type safety
export interface ScreenFrame {
  computerId: string;
  frame: string;
  timestamp: number;
  monitorIndex: number;
}

export interface Heartbeat {
  computerId: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeWindow?: string;
  activeProcess?: string;
  isIdle: boolean;
  idleTime: number;
}

export interface KeystrokeData {
  computerId: string;
  strokes: Array<{
    keys: string;
    applicationName: string;
    windowTitle: string;
    timestamp: number;
  }>;
}

export interface ClipboardData {
  computerId: string;
  content: string;
  contentType: string;
  timestamp: number;
}

export interface ProcessData {
  computerId: string;
  processes: Array<{
    processName: string;
    processId: number;
    path: string;
    cpuUsage: number;
    memoryUsage: number;
    username: string;
    startedAt?: number;
  }>;
}

export interface TerminalOutput {
  sessionId: string;
  output: string;
}

export interface CommandResponse {
  commandId: string;
  success: boolean;
  response?: string;
  error?: string;
}
