"use client";

import { io, Socket } from "socket.io-client";

let consoleSocket: Socket | null = null;

export function getConsoleSocket(): Socket {
  if (!consoleSocket) {
    consoleSocket = io("/console", {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
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
