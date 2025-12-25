"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Monitor,
  Eye,
  MousePointer2,
  Terminal,
  Play,
  Square,
  Laptop,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Maximize2,
  Upload,
  Download,
  FolderOpen,
  File,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { LiveRemoteDesktop } from "@/components/remote/LiveRemoteDesktop";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  status: string;
  osType: string;
  ipAddress: string | null;
}

interface RemoteSession {
  id: string;
  computerId: string;
  computer: { id: string; name: string; hostname: string; ipAddress: string | null };
  userId: string;
  sessionType: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  sessionKey: string | null;
}

interface FileTransfer {
  id: string;
  computerId: string;
  computer: { id: string; name: string; hostname: string };
  direction: string;
  localPath: string;
  remotePath: string;
  fileName: string;
  fileSize: number;
  status: string;
  progress: number;
  startedAt: string;
  completedAt: string | null;
}

export default function RemoteControlPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [selectedComputer, setSelectedComputer] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<RemoteSession | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchComputers();
    fetchSessions();
    fetchTransfers();
    const interval = setInterval(() => {
      fetchSessions();
      fetchTransfers();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchComputers() {
    try {
      const res = await fetch("/api/computers");
      if (res.ok) {
        const data = await res.json();
        setComputers(data);
      }
    } catch (error) {
      console.error("Failed to fetch computers:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch("/api/remote-sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  }

  async function fetchTransfers() {
    try {
      const res = await fetch("/api/file-transfers");
      if (res.ok) {
        const data = await res.json();
        setTransfers(data);
      }
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
    }
  }

  async function startSession(sessionType: string) {
    if (!selectedComputer) {
      toast.error("Please select a computer first");
      return;
    }

    const computer = computers.find((c) => c.id === selectedComputer);
    if (computer?.status !== "ONLINE") {
      toast.error("Computer is not online");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch("/api/remote-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          computerId: selectedComputer,
          sessionType,
        }),
      });

      if (res.ok) {
        const session = await res.json();
        toast.success(`${sessionType} session started`);
        setActiveSession(session);
        setSessionDialogOpen(true);
        fetchSessions();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to start session");
      }
    } catch (error) {
      toast.error("Failed to start session");
      console.error(error);
    } finally {
      setStarting(false);
    }
  }

  async function endSession(sessionId: string) {
    try {
      const res = await fetch(`/api/remote-sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Session ended");
        setSessionDialogOpen(false);
        setActiveSession(null);
        fetchSessions();
      } else {
        toast.error("Failed to end session");
      }
    } catch (error) {
      toast.error("Failed to end session");
      console.error(error);
    }
  }

  const selectedComputerData = computers.find((c) => c.id === selectedComputer);
  const activeSessions = sessions.filter((s) => s.status === "ACTIVE" || s.status === "PENDING");

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case "VIEW":
        return <Eye className="h-4 w-4" />;
      case "CONTROL":
        return <MousePointer2 className="h-4 w-4" />;
      case "SHELL":
        return <Terminal className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-500">Active</Badge>;
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "ENDED":
        return <Badge variant="outline">Ended</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Monitor className="h-8 w-8" />
            Remote Control
          </h1>
          <p className="text-muted-foreground">
            View and control remote computers, transfer files
          </p>
        </div>
        <Button variant="outline" onClick={() => { fetchSessions(); fetchTransfers(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Computer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5" />
            Select Computer
          </CardTitle>
          <CardDescription>Choose a computer to connect to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedComputer} onValueChange={setSelectedComputer}>
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue placeholder="Select a computer..." />
              </SelectTrigger>
              <SelectContent>
                {computers.map((computer) => (
                  <SelectItem key={computer.id} value={computer.id}>
                    <div className="flex items-center gap-2">
                      {computer.status === "ONLINE" ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-gray-400" />
                      )}
                      <span>{computer.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({computer.hostname})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedComputerData && (
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant={selectedComputerData.status === "ONLINE" ? "default" : "secondary"}>
                  {selectedComputerData.status}
                </Badge>
                <Badge variant="outline">{selectedComputerData.osType}</Badge>
                {selectedComputerData.ipAddress && (
                  <Badge variant="outline">{selectedComputerData.ipAddress}</Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Types */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => startSession("VIEW")}>
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-full bg-blue-500/10 w-fit">
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle>View Only</CardTitle>
            <CardDescription>
              Watch the screen in real-time without controlling
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              disabled={!selectedComputer || selectedComputerData?.status !== "ONLINE" || starting}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Viewing
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => startSession("CONTROL")}>
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-full bg-green-500/10 w-fit">
              <MousePointer2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Full Control</CardTitle>
            <CardDescription>
              Take control of keyboard and mouse
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              disabled={!selectedComputer || selectedComputerData?.status !== "ONLINE" || starting}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Take Control
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => startSession("SHELL")}>
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-full bg-purple-500/10 w-fit">
              <Terminal className="h-8 w-8 text-purple-500" />
            </div>
            <CardTitle>Remote Shell</CardTitle>
            <CardDescription>
              Open a command-line terminal session
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              disabled={!selectedComputer || selectedComputerData?.status !== "ONLINE" || starting}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Open Shell
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <Card className="border-green-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              Active Sessions ({activeSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((session) => (
                <Card key={session.id} className="border-green-500/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSessionTypeIcon(session.sessionType)}
                        <span className="font-medium">{session.computer.name}</span>
                      </div>
                      {getStatusBadge(session.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setActiveSession(session);
                          setSessionDialogOpen(true);
                        }}
                      >
                        <Maximize2 className="h-4 w-4 mr-1" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => endSession(session.id)}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Sessions and File Transfers */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Session History</TabsTrigger>
          <TabsTrigger value="transfers">File Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>Previous remote sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No remote sessions yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Computer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.slice(0, 20).map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Laptop className="h-4 w-4 text-muted-foreground" />
                            {session.computer.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getSessionTypeIcon(session.sessionType)}
                            <span>{session.sessionType}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(session.startedAt), "PPp")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {session.endedAt
                            ? formatDistanceToNow(new Date(session.startedAt))
                            : "Ongoing"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle>File Transfers</CardTitle>
              <CardDescription>Upload and download file history</CardDescription>
            </CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No file transfers yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Direction</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Computer</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          {transfer.direction === "UPLOAD" ? (
                            <div className="flex items-center gap-1 text-blue-500">
                              <Upload className="h-4 w-4" />
                              Upload
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-500">
                              <Download className="h-4 w-4" />
                              Download
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{transfer.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{transfer.computer.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {(transfer.fileSize / 1024 / 1024).toFixed(2)} MB
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transfer.status === "COMPLETED"
                                ? "default"
                                : transfer.status === "FAILED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {transfer.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${transfer.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {transfer.progress}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Remote Session Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-6xl h-[85vh] p-0 gap-0">
          {activeSession && (
            <LiveRemoteDesktop
              computerId={activeSession.computerId}
              computerName={activeSession.computer.name}
              sessionType={activeSession.sessionType as "VIEW" | "CONTROL" | "SHELL"}
              sessionId={activeSession.id}
              onEnd={() => endSession(activeSession.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
