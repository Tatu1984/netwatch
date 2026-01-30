"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getConsoleSocket } from "@/lib/socket-client";
import { Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Minimize2,
  MousePointer2,
  Eye,
  Terminal,
  Keyboard,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LiveRemoteDesktopProps {
  computerId: string;
  computerName: string;
  sessionType: "VIEW" | "CONTROL" | "SHELL";
  sessionId: string;
  onEnd: () => void;
}

export function LiveRemoteDesktop({
  computerId,
  computerName,
  sessionType,
  sessionId,
  onEnd,
}: LiveRemoteDesktopProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality, setQuality] = useState(60);
  const [targetFps, setTargetFps] = useState(sessionType === "CONTROL" ? 15 : 5);
  const [lastFrameTime, setLastFrameTime] = useState<number>(Date.now());
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [receivingFrames, setReceivingFrames] = useState(false);
  const frameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const terminalRef = useRef<HTMLDivElement>(null);

  // Connect to shared socket
  useEffect(() => {
    const socket = getConsoleSocket();
    socketRef.current = socket;

    const onConnect = () => {
      console.log("Connected to console namespace");
      setConnected(true);
      socket.emit("auth", { userId: "dashboard" });
    };

    const onAuthSuccess = () => {
      console.log("Console authenticated");
      socket.emit("watch_computer", { computerId });
      if (sessionType === "SHELL") {
        socket.emit("start_terminal", { computerId, sessionId });
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      setReceivingFrames(false);
    };

    const onScreenFrame = (data: { computerId: string; frame: string; timestamp: number }) => {
      if (data.computerId !== computerId) return;
      renderFrame(data.frame);
      const now = Date.now();
      setLatency(now - data.timestamp);
      setLastFrameTime(now);
      frameCountRef.current++;

      // Reset frame timeout
      setReceivingFrames(true);
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = setTimeout(() => setReceivingFrames(false), 3000);
    };

    const onTerminalOutput = (data: { sessionId: string; output: string }) => {
      if (data.sessionId !== sessionId) return;
      setTerminalOutput((prev) => [...prev, data.output]);
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    };

    socket.on("connect", onConnect);
    socket.on("auth_success", onAuthSuccess);
    socket.on("disconnect", onDisconnect);
    socket.on("screen_frame", onScreenFrame);
    socket.on("terminal_output", onTerminalOutput);

    if (!socket.connected) {
      socket.connect();
    } else {
      // Already connected, just auth + watch
      socket.emit("auth", { userId: "dashboard" });
    }

    fpsIntervalRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      socket.emit("unwatch_computer", { computerId });
      socket.off("connect", onConnect);
      socket.off("auth_success", onAuthSuccess);
      socket.off("disconnect", onDisconnect);
      socket.off("screen_frame", onScreenFrame);
      socket.off("terminal_output", onTerminalOutput);
    };
  }, [computerId, sessionId, sessionType]);

  // Render frame to canvas
  const renderFrame = useCallback((base64Frame: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Resize canvas if needed
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${base64Frame}`;
  }, []);

  // Handle mouse events (for CONTROL mode)
  const handleMouseEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>, type: string) => {
      if (sessionType !== "CONTROL" || !socketRef.current || !canvasRef.current)
        return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      socketRef.current.emit("remote_input", {
        computerId,
        type: "mouse",
        event: {
          type,
          x,
          y,
          button: e.button,
        },
      });
    },
    [computerId, sessionType]
  );

  // Handle keyboard events (for CONTROL mode)
  const handleKeyEvent = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>, type: string) => {
      if (sessionType !== "CONTROL" || !socketRef.current) return;

      e.preventDefault();

      socketRef.current.emit("remote_input", {
        computerId,
        type: "keyboard",
        event: {
          type,
          key: e.key,
          code: e.code,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        },
      });
    },
    [computerId, sessionType]
  );

  // Handle terminal input
  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || !socketRef.current) return;

    socketRef.current.emit("terminal_input", {
      computerId,
      sessionId,
      input: terminalInput + "\n",
    });

    setTerminalInput("");
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Update quality/fps
  const updateSettings = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("update_stream_settings", {
      computerId,
      quality,
      fps: targetFps,
    });
  };

  // Request screenshot
  const requestScreenshot = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("request_screenshot", { computerId });
  };

  if (sessionType === "SHELL") {
    return (
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 bg-muted border-b">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="font-medium">{computerName}</span>
            <Badge variant={connected ? "default" : "destructive"}>
              {connected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button variant="destructive" size="sm" onClick={onEnd}>
              End Session
            </Button>
          </div>
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          className="flex-1 bg-black text-green-400 font-mono text-sm p-4 overflow-auto"
        >
          {terminalOutput.map((line, i) => (
            <pre key={i} className="whitespace-pre-wrap">
              {line}
            </pre>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleTerminalSubmit} className="flex border-t">
          <span className="bg-black text-green-400 p-2 font-mono">$</span>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            className="flex-1 bg-black text-green-400 font-mono p-2 outline-none"
            placeholder="Enter command..."
            autoFocus
          />
        </form>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {sessionType === "CONTROL" ? (
              <MousePointer2 className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="font-medium">{computerName}</span>
          </div>

          <Badge variant={connected ? "default" : "destructive"}>
            {connected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{fps} FPS</span>
            <span>•</span>
            <span>{latency}ms</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionType === "CONTROL" && (
            <Badge variant="outline" className="gap-1">
              <Keyboard className="h-3 w-3" />
              Click canvas to enable input
            </Badge>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-4">
                <div>
                  <Label>Quality: {quality}%</Label>
                  <Slider
                    value={[quality]}
                    min={20}
                    max={100}
                    step={10}
                    onValueChange={([v]) => setQuality(v)}
                    onValueCommit={updateSettings}
                  />
                </div>
                <div>
                  <Label>Target FPS</Label>
                  <Select
                    value={targetFps.toString()}
                    onValueChange={(v) => {
                      setTargetFps(parseInt(v));
                      updateSettings();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 FPS</SelectItem>
                      <SelectItem value="10">10 FPS</SelectItem>
                      <SelectItem value="15">15 FPS</SelectItem>
                      <SelectItem value="30">30 FPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={requestScreenshot}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          <Button variant="destructive" size="sm" onClick={onEnd}>
            End Session
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
        {connected ? (
          <>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              className="max-w-full max-h-full object-contain cursor-crosshair focus:outline-none"
              onMouseDown={(e) => handleMouseEvent(e, "mousedown")}
              onMouseUp={(e) => handleMouseEvent(e, "mouseup")}
              onMouseMove={(e) => handleMouseEvent(e, "mousemove")}
              onClick={(e) => handleMouseEvent(e, "click")}
              onDoubleClick={(e) => handleMouseEvent(e, "dblclick")}
              onContextMenu={(e) => {
                e.preventDefault();
                handleMouseEvent(e, "contextmenu");
              }}
              onKeyDown={(e) => handleKeyEvent(e, "keydown")}
              onKeyUp={(e) => handleKeyEvent(e, "keyup")}
            />
            {!receivingFrames && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center text-white">
                  <RefreshCw className="h-10 w-10 mx-auto mb-3 animate-spin opacity-70" />
                  <p>Waiting for screen data...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
            <p>Connecting to {computerName}...</p>
          </div>
        )}
      </div>
    </div>
  );
}
