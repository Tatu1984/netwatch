import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { prisma } from "./prisma";

let io: SocketIOServer | null = null;

// Store connected agents and consoles
const connectedAgents = new Map<string, {
  socketId: string;
  computerId: string;
  lastHeartbeat: Date;
}>();

const connectedConsoles = new Map<string, {
  socketId: string;
  userId: string;
  watchingComputers: Set<string>;
}>();

export function initSocketServer(httpServer: HttpServer) {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? process.env.NEXTAUTH_URL
        : ["http://localhost:3000", "http://localhost:4000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Agent namespace - for desktop agents
  const agentNamespace = io.of("/agent");

  // Console namespace - for admin dashboard
  const consoleNamespace = io.of("/console");

  // ==================== AGENT HANDLERS ====================
  agentNamespace.on("connection", async (socket) => {
    console.log(`Agent connecting: ${socket.id}`);

    // Agent authentication
    socket.on("auth", async (data: {
      machineId: string;
      hostname: string;
      osType: string;
      osVersion: string;
      macAddress: string;
      ipAddress: string;
      agentVersion: string;
    }) => {
      try {
        // Find or create computer record
        let computer = await prisma.computer.findFirst({
          where: {
            OR: [
              { macAddress: data.macAddress },
              { hostname: data.hostname }
            ]
          },
        });

        if (!computer) {
          // Auto-register new computer
          const org = await prisma.organization.findFirst();
          if (!org) {
            socket.emit("auth_error", { message: "No organization found" });
            return;
          }

          computer = await prisma.computer.create({
            data: {
              name: data.hostname,
              hostname: data.hostname,
              macAddress: data.macAddress,
              ipAddress: data.ipAddress,
              osType: data.osType,
              osVersion: data.osVersion,
              agentVersion: data.agentVersion,
              status: "ONLINE",
              lastSeen: new Date(),
              organizationId: org.id,
            },
          });
        } else {
          // Update existing computer
          computer = await prisma.computer.update({
            where: { id: computer.id },
            data: {
              ipAddress: data.ipAddress,
              osType: data.osType,
              osVersion: data.osVersion,
              agentVersion: data.agentVersion,
              status: "ONLINE",
              lastSeen: new Date(),
            },
          });
        }

        // Store connection
        connectedAgents.set(computer.id, {
          socketId: socket.id,
          computerId: computer.id,
          lastHeartbeat: new Date(),
        });

        socket.data.computerId = computer.id;
        socket.join(`computer:${computer.id}`);

        socket.emit("auth_success", {
          computerId: computer.id,
          config: {
            screenshotInterval: 5000,
            activityLogInterval: 10000,
            keystrokeBufferSize: 100,
          }
        });

        // Notify consoles about new agent
        consoleNamespace.emit("agent_online", {
          computerId: computer.id,
          hostname: data.hostname,
        });

        console.log(`Agent authenticated: ${computer.hostname} (${computer.id})`);

        // Check for pending commands
        const pendingCommands = await prisma.deviceCommand.findMany({
          where: {
            computerId: computer.id,
            status: "PENDING",
          },
          orderBy: { createdAt: "asc" },
        });

        for (const cmd of pendingCommands) {
          socket.emit("command", {
            id: cmd.id,
            command: cmd.command,
            payload: cmd.payload ? JSON.parse(cmd.payload) : null,
          });

          await prisma.deviceCommand.update({
            where: { id: cmd.id },
            data: { status: "SENT", sentAt: new Date() },
          });
        }

      } catch (error) {
        console.error("Agent auth error:", error);
        socket.emit("auth_error", { message: "Authentication failed" });
      }
    });

    // Heartbeat
    socket.on("heartbeat", async (data: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      activeWindow?: string;
      activeProcess?: string;
      isIdle: boolean;
      idleTime: number;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      const agent = connectedAgents.get(computerId);
      if (agent) {
        agent.lastHeartbeat = new Date();
      }

      await prisma.computer.update({
        where: { id: computerId },
        data: {
          lastSeen: new Date(),
          cpuUsage: data.cpuUsage,
          memoryUsage: data.memoryUsage,
          diskUsage: data.diskUsage,
          status: "ONLINE",
        },
      });

      // Broadcast to watching consoles
      consoleNamespace.to(`watching:${computerId}`).emit("heartbeat", {
        computerId,
        ...data,
      });
    });

    // Screenshot/Screen frame
    socket.on("screen_frame", (data: {
      frame: string; // Base64 encoded JPEG
      timestamp: number;
      monitorIndex: number;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      // Broadcast to watching consoles
      consoleNamespace.to(`watching:${computerId}`).emit("screen_frame", {
        computerId,
        ...data,
      });
    });

    // Screenshot for storage
    socket.on("screenshot", async (data: {
      image: string; // Base64 encoded
      timestamp: number;
      activeWindow: string;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      try {
        // Store screenshot
        await prisma.screenshot.create({
          data: {
            computerId,
            filePath: `screenshots/${computerId}/${Date.now()}.jpg`,
            fileSize: Math.ceil(data.image.length * 0.75), // Approximate size
            activeWindow: data.activeWindow,
            capturedAt: new Date(data.timestamp),
          },
        });
      } catch (error) {
        console.error("Error saving screenshot:", error);
      }
    });

    // Activity logs
    socket.on("activity_log", async (data: {
      logs: Array<{
        applicationName: string;
        windowTitle: string;
        startTime: number;
        endTime: number;
        duration: number;
        category?: string;
      }>;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      try {
        for (const log of data.logs) {
          await prisma.activityLog.create({
            data: {
              computerId,
              applicationName: log.applicationName,
              windowTitle: log.windowTitle,
              startTime: new Date(log.startTime),
              endTime: new Date(log.endTime),
              duration: log.duration,
              category: log.category,
            },
          });
        }
      } catch (error) {
        console.error("Error saving activity logs:", error);
      }
    });

    // Keystrokes
    socket.on("keystrokes", async (data: {
      strokes: Array<{
        keys: string;
        applicationName: string;
        windowTitle: string;
        timestamp: number;
      }>;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      try {
        for (const stroke of data.strokes) {
          await prisma.keylog.create({
            data: {
              computerId,
              keystrokes: stroke.keys,
              application: stroke.applicationName,
              windowTitle: stroke.windowTitle,
              capturedAt: new Date(stroke.timestamp),
            },
          });
        }

        // Notify watching consoles
        consoleNamespace.to(`watching:${computerId}`).emit("keystrokes", {
          computerId,
          strokes: data.strokes,
        });
      } catch (error) {
        console.error("Error saving keystrokes:", error);
      }
    });

    // Clipboard
    socket.on("clipboard", async (data: {
      content: string;
      contentType: string;
      timestamp: number;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      try {
        await prisma.clipboardLog.create({
          data: {
            computerId,
            content: data.content,
            contentType: data.contentType,
            capturedAt: new Date(data.timestamp),
          },
        });

        // Notify watching consoles
        consoleNamespace.to(`watching:${computerId}`).emit("clipboard", {
          computerId,
          ...data,
        });
      } catch (error) {
        console.error("Error saving clipboard:", error);
      }
    });

    // Process list
    socket.on("process_list", async (data: {
      processes: Array<{
        processName: string;
        processId: number;
        path: string;
        cpuUsage: number;
        memoryUsage: number;
        username: string;
        startedAt?: number;
      }>;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      try {
        // Store process snapshot - delete old and insert new
        await prisma.processLog.deleteMany({
          where: { computerId },
        });

        await prisma.processLog.createMany({
          data: data.processes.map(proc => ({
            computerId,
            processName: proc.processName,
            processId: proc.processId,
            path: proc.path,
            cpuUsage: proc.cpuUsage,
            memoryUsage: proc.memoryUsage,
            username: proc.username,
            startedAt: proc.startedAt ? new Date(proc.startedAt) : null,
            capturedAt: new Date(),
          })),
        });

        // Notify watching consoles
        consoleNamespace.to(`watching:${computerId}`).emit("process_list", {
          computerId,
          processes: data.processes,
        });
      } catch (error) {
        console.error("Error saving process list:", error);
      }
    });

    // Website visits
    socket.on("website_visit", async (data: {
      url: string;
      title: string;
      browser: string;
      duration: number;
      timestamp: number;
    }) => {
      const computerId = socket.data.computerId;
      if (!computerId) return;

      try {
        await prisma.websiteLog.create({
          data: {
            computerId,
            url: data.url,
            title: data.title,
            browser: data.browser,
            duration: data.duration,
            visitedAt: new Date(data.timestamp),
          },
        });
      } catch (error) {
        console.error("Error saving website visit:", error);
      }
    });

    // Command response
    socket.on("command_response", async (data: {
      commandId: string;
      success: boolean;
      response?: string;
      error?: string;
    }) => {
      try {
        await prisma.deviceCommand.update({
          where: { id: data.commandId },
          data: {
            status: data.success ? "EXECUTED" : "FAILED",
            executedAt: new Date(),
            response: data.response || data.error,
          },
        });

        // Notify consoles
        consoleNamespace.emit("command_response", data);
      } catch (error) {
        console.error("Error updating command response:", error);
      }
    });

    // Terminal output
    socket.on("terminal_output", (data: {
      sessionId: string;
      output: string;
    }) => {
      consoleNamespace.to(`terminal:${data.sessionId}`).emit("terminal_output", data);
    });

    // File transfer progress
    socket.on("file_transfer_progress", (data: {
      transferId: string;
      progress: number;
      bytesTransferred: number;
    }) => {
      consoleNamespace.emit("file_transfer_progress", data);
    });

    // Disconnection
    socket.on("disconnect", async () => {
      const computerId = socket.data.computerId;
      if (computerId) {
        connectedAgents.delete(computerId);

        await prisma.computer.update({
          where: { id: computerId },
          data: {
            status: "OFFLINE",
            lastSeen: new Date(),
          },
        });

        consoleNamespace.emit("agent_offline", { computerId });
        console.log(`Agent disconnected: ${computerId}`);
      }
    });
  });

  // ==================== CONSOLE HANDLERS ====================
  consoleNamespace.on("connection", (socket) => {
    console.log(`Console connected: ${socket.id}`);

    // Console authentication (would integrate with NextAuth session)
    socket.on("auth", async (data: { userId: string }) => {
      connectedConsoles.set(socket.id, {
        socketId: socket.id,
        userId: data.userId,
        watchingComputers: new Set(),
      });

      // Send list of online agents
      const onlineAgents = Array.from(connectedAgents.entries()).map(([id, agent]) => ({
        computerId: id,
        socketId: agent.socketId,
        lastHeartbeat: agent.lastHeartbeat,
      }));

      socket.emit("auth_success", { onlineAgents });
    });

    // Start watching a computer
    socket.on("watch_computer", (data: { computerId: string }) => {
      const client = connectedConsoles.get(socket.id);
      if (client) {
        client.watchingComputers.add(data.computerId);
        socket.join(`watching:${data.computerId}`);

        // Request screen stream from agent
        const agent = connectedAgents.get(data.computerId);
        if (agent) {
          agentNamespace.to(agent.socketId).emit("start_screen_stream", {
            quality: 60,
            fps: 5,
          });
        }
      }
    });

    // Stop watching a computer
    socket.on("unwatch_computer", (data: { computerId: string }) => {
      const client = connectedConsoles.get(socket.id);
      if (client) {
        client.watchingComputers.delete(data.computerId);
        socket.leave(`watching:${data.computerId}`);

        // Check if anyone else is watching, if not stop streaming
        const watchersRoom = consoleNamespace.adapter.rooms.get(`watching:${data.computerId}`);
        if (!watchersRoom || watchersRoom.size === 0) {
          const agent = connectedAgents.get(data.computerId);
          if (agent) {
            agentNamespace.to(agent.socketId).emit("stop_screen_stream");
          }
        }
      }
    });

    // Send command to agent
    socket.on("send_command", async (data: {
      computerId: string;
      command: string;
      payload?: Record<string, unknown>;
    }) => {
      const agent = connectedAgents.get(data.computerId);

      // Create command record
      const cmd = await prisma.deviceCommand.create({
        data: {
          computerId: data.computerId,
          command: data.command,
          payload: data.payload ? JSON.stringify(data.payload) : null,
          status: agent ? "SENT" : "PENDING",
          sentAt: agent ? new Date() : null,
        },
      });

      if (agent) {
        agentNamespace.to(agent.socketId).emit("command", {
          id: cmd.id,
          command: data.command,
          payload: data.payload,
        });
      }

      socket.emit("command_sent", { commandId: cmd.id, queued: !agent });
    });

    // Remote control - mouse/keyboard input
    socket.on("remote_input", (data: {
      computerId: string;
      type: "mouse" | "keyboard";
      event: Record<string, unknown>;
    }) => {
      const agent = connectedAgents.get(data.computerId);
      if (agent) {
        agentNamespace.to(agent.socketId).emit("remote_input", data);
      }
    });

    // Terminal input
    socket.on("terminal_input", (data: {
      computerId: string;
      sessionId: string;
      input: string;
    }) => {
      const agent = connectedAgents.get(data.computerId);
      if (agent) {
        socket.join(`terminal:${data.sessionId}`);
        agentNamespace.to(agent.socketId).emit("terminal_input", data);
      }
    });

    // Start terminal session
    socket.on("start_terminal", async (data: {
      computerId: string;
      shell?: string;
    }) => {
      const agent = connectedAgents.get(data.computerId);
      if (agent) {
        const session = await prisma.remoteSession.create({
          data: {
            computerId: data.computerId,
            userId: connectedConsoles.get(socket.id)?.userId || "unknown",
            sessionType: "SHELL",
            status: "ACTIVE",
            startedAt: new Date(),
          },
        });

        socket.join(`terminal:${session.id}`);
        agentNamespace.to(agent.socketId).emit("start_terminal", {
          sessionId: session.id,
          shell: data.shell,
        });

        socket.emit("terminal_started", { sessionId: session.id });
      }
    });

    // File transfer request
    socket.on("file_transfer", async (data: {
      computerId: string;
      direction: "UPLOAD" | "DOWNLOAD";
      remotePath: string;
      localPath?: string;
      fileData?: string; // Base64 for upload
    }) => {
      const agent = connectedAgents.get(data.computerId);
      if (agent) {
        const transfer = await prisma.fileTransfer.create({
          data: {
            computerId: data.computerId,
            fileName: data.remotePath.split("/").pop() || "unknown",
            remotePath: data.remotePath,
            localPath: data.localPath || data.remotePath,
            direction: data.direction,
            status: "IN_PROGRESS",
            startedAt: new Date(),
          },
        });

        agentNamespace.to(agent.socketId).emit("file_transfer", {
          transferId: transfer.id,
          ...data,
        });

        socket.emit("file_transfer_started", { transferId: transfer.id });
      }
    });

    // Request full screenshot
    socket.on("request_screenshot", (data: { computerId: string }) => {
      const agent = connectedAgents.get(data.computerId);
      if (agent) {
        agentNamespace.to(agent.socketId).emit("capture_screenshot");
      }
    });

    // Start remote control session
    socket.on("start_remote_control", async (data: {
      computerId: string;
      mode: "VIEW" | "CONTROL";
    }) => {
      const agent = connectedAgents.get(data.computerId);
      if (agent) {
        const session = await prisma.remoteSession.create({
          data: {
            computerId: data.computerId,
            userId: connectedConsoles.get(socket.id)?.userId || "unknown",
            sessionType: data.mode,
            status: "ACTIVE",
            startedAt: new Date(),
          },
        });

        socket.join(`watching:${data.computerId}`);
        agentNamespace.to(agent.socketId).emit("start_remote_control", {
          sessionId: session.id,
          mode: data.mode,
          quality: data.mode === "CONTROL" ? 80 : 60,
          fps: data.mode === "CONTROL" ? 15 : 5,
        });

        socket.emit("remote_control_started", { sessionId: session.id });
      }
    });

    socket.on("disconnect", () => {
      const connectedClient = connectedConsoles.get(socket.id);
      if (connectedClient) {
        // Stop watching all computers
        for (const computerId of connectedClient.watchingComputers) {
          const watchersRoom = consoleNamespace.adapter.rooms.get(`watching:${computerId}`);
          if (!watchersRoom || watchersRoom.size <= 1) {
            const agent = connectedAgents.get(computerId);
            if (agent) {
              agentNamespace.to(agent.socketId).emit("stop_screen_stream");
            }
          }
        }
        connectedConsoles.delete(socket.id);
      }
      console.log(`Console disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function getConnectedAgents() {
  return connectedAgents;
}

export function getConnectedConsoles() {
  return connectedConsoles;
}
