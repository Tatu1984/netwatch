"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Camera,
  Video,
  Maximize,
  RefreshCw,
  Monitor,
  Cpu,
  Globe,
  Lock,
  Unlock,
  Power,
  RotateCcw,
  MessageSquare,
  LogOut,
  Moon,
  Terminal,
  MousePointer2,
  Eye,
  Keyboard,
  Clipboard,
  Activity,
  Shield,
  Skull,
  AlertTriangle,
  Play,
  HardDrive,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MousePointer2Off,
  Plus,
  Trash2,
  Copy,
  FileText,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Activity {
  id: string;
  type: string;
  title: string;
  startedAt: Date;
  category: string | null;
}

interface Computer {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string | null;
  osType: string;
  status: string;
  lastSeen: Date | null;
  groupName: string;
  groupColor: string;
  activities: Activity[];
}

interface SingleComputerViewProps {
  computer: Computer;
}

interface Keylog {
  id: string;
  windowTitle: string | null;
  application: string | null;
  keystrokes: string;
  capturedAt: string;
}

interface ClipboardLog {
  id: string;
  contentType: string;
  content: string;
  application: string | null;
  capturedAt: string;
}

interface ProcessLog {
  id: string;
  processName: string;
  processId: number;
  path: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  username: string | null;
}

interface FirewallRule {
  id: string;
  name: string;
  direction: string;
  action: string;
  protocol: string;
  port: string | null;
  remoteIp: string | null;
  isActive: boolean;
  priority: number;
}

interface DeviceCommand {
  id: string;
  command: string;
  status: string;
  createdAt: string;
  executedAt: string | null;
  response: string | null;
}

interface ComputerStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  isLocked: boolean;
}

export function SingleComputerView({ computer }: SingleComputerViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<ComputerStats>({ cpuUsage: 0, memoryUsage: 0, diskUsage: 0, isLocked: false });

  // Data states
  const [keylogs, setKeylogs] = useState<Keylog[]>([]);
  const [clipboardLogs, setClipboardLogs] = useState<ClipboardLog[]>([]);
  const [processes, setProcesses] = useState<ProcessLog[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);

  // Dialog states
  const [messageDialog, setMessageDialog] = useState(false);
  const [executeDialog, setExecuteDialog] = useState(false);
  const [killDialog, setKillDialog] = useState<{ open: boolean; process: ProcessLog | null }>({ open: false, process: null });
  const [firewallDialog, setFirewallDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; command: string; label: string }>({ open: false, command: "", label: "" });

  // Form states
  const [message, setMessage] = useState("");
  const [executeCommand, setExecuteCommand] = useState("");
  const [newRule, setNewRule] = useState({
    name: "",
    direction: "INBOUND",
    action: "BLOCK",
    protocol: "TCP",
    port: "",
    remoteIp: "",
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [computer.id]);

  async function fetchData() {
    await Promise.all([
      fetchKeylogs(),
      fetchClipboard(),
      fetchProcesses(),
      fetchFirewall(),
      fetchCommands(),
      fetchStats(),
    ]);
  }

  async function fetchStats() {
    try {
      const res = await fetch(`/api/computers/${computer.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          cpuUsage: data.cpuUsage || 0,
          memoryUsage: data.memoryUsage || 0,
          diskUsage: data.diskUsage || 0,
          isLocked: data.isLocked || false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }

  async function fetchKeylogs() {
    try {
      const res = await fetch(`/api/keylogs?computerId=${computer.id}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setKeylogs(data.keylogs || []);
      }
    } catch (error) {
      console.error("Failed to fetch keylogs:", error);
    }
  }

  async function fetchClipboard() {
    try {
      const res = await fetch(`/api/clipboard?computerId=${computer.id}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setClipboardLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch clipboard:", error);
    }
  }

  async function fetchProcesses() {
    try {
      const res = await fetch(`/api/processes?computerId=${computer.id}&live=true`);
      if (res.ok) {
        const data = await res.json();
        setProcesses(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch processes:", error);
    }
  }

  async function fetchFirewall() {
    try {
      const res = await fetch(`/api/firewall?computerId=${computer.id}`);
      if (res.ok) {
        const data = await res.json();
        setFirewallRules(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch firewall:", error);
    }
  }

  async function fetchCommands() {
    try {
      const res = await fetch(`/api/commands?computerId=${computer.id}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setCommands(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch commands:", error);
    }
  }

  async function sendCommand(command: string, payload?: object) {
    setSending(true);
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ computerId: computer.id, command, payload }),
      });
      if (res.ok) {
        toast.success(`${command} command sent`);
        fetchCommands();
        fetchStats();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to send command");
      }
    } catch (error) {
      toast.error("Failed to send command");
    } finally {
      setSending(false);
      setConfirmDialog({ open: false, command: "", label: "" });
    }
  }

  async function killProcess(process: ProcessLog) {
    try {
      await sendCommand("KILL_PROCESS", { processId: process.processId, processName: process.processName });
      setKillDialog({ open: false, process: null });
      setTimeout(fetchProcesses, 2000);
    } catch (error) {
      console.error(error);
    }
  }

  async function toggleFirewallRule(rule: FirewallRule) {
    try {
      const res = await fetch(`/api/firewall/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) {
        toast.success(`Rule ${rule.isActive ? "disabled" : "enabled"}`);
        fetchFirewall();
      }
    } catch (error) {
      toast.error("Failed to update rule");
    }
  }

  async function deleteFirewallRule(id: string) {
    try {
      const res = await fetch(`/api/firewall/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Rule deleted");
        fetchFirewall();
      }
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  }

  async function createFirewallRule() {
    try {
      const res = await fetch("/api/firewall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newRule, computerId: computer.id }),
      });
      if (res.ok) {
        toast.success("Rule created");
        setFirewallDialog(false);
        setNewRule({ name: "", direction: "INBOUND", action: "BLOCK", protocol: "TCP", port: "", remoteIp: "" });
        fetchFirewall();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create rule");
      }
    } catch (error) {
      toast.error("Failed to create rule");
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "EXECUTED": return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "PENDING": return <Clock className="h-3 w-3 text-yellow-500" />;
      case "SENT": return <Send className="h-3 w-3 text-blue-500" />;
      case "FAILED": return <XCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/monitoring">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{computer.name}</h1>
            <Badge variant={computer.status === "ONLINE" ? "default" : "secondary"} className={computer.status === "ONLINE" ? "bg-green-500" : ""}>
              {computer.status}
            </Badge>
            {stats.isLocked && <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
            <Badge style={{ backgroundColor: computer.groupColor, color: "white" }}>{computer.groupName}</Badge>
          </div>
          <p className="text-muted-foreground">{computer.hostname} • {computer.ipAddress || "N/A"}</p>
        </div>
      </div>

      {/* Quick Control Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium mr-2">Quick Actions:</span>
            <Button size="sm" variant="outline" onClick={() => setConfirmDialog({ open: true, command: "LOCK", label: "Lock" })} disabled={sending}>
              <Lock className="h-4 w-4 mr-1" />Lock
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendCommand("UNLOCK")} disabled={sending}>
              <Unlock className="h-4 w-4 mr-1" />Unlock
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDialog({ open: true, command: "SHUTDOWN", label: "Shutdown" })} disabled={sending}>
              <Power className="h-4 w-4 mr-1" />Shutdown
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDialog({ open: true, command: "RESTART", label: "Restart" })} disabled={sending}>
              <RotateCcw className="h-4 w-4 mr-1" />Restart
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendCommand("LOGOFF")} disabled={sending}>
              <LogOut className="h-4 w-4 mr-1" />Logoff
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendCommand("SLEEP")} disabled={sending}>
              <Moon className="h-4 w-4 mr-1" />Sleep
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendCommand("BLOCK_INPUT")} disabled={sending}>
              <MousePointer2Off className="h-4 w-4 mr-1" />Block Input
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendCommand("UNBLOCK_INPUT")} disabled={sending}>
              <MousePointer2 className="h-4 w-4 mr-1" />Unblock
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setMessageDialog(true)} disabled={sending}>
              <MessageSquare className="h-4 w-4 mr-1" />Message
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExecuteDialog(true)} disabled={sending}>
              <Terminal className="h-4 w-4 mr-1" />Execute
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Main Screen View */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-black">
              {computer.status === "ONLINE" ? (
                <>
                  <Image
                    src={`https://picsum.photos/seed/${computer.id}/1920/1080?v=${refreshKey}`}
                    alt={`${computer.name} screen`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />Recording
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <Button size="sm" onClick={() => toast.success("Screenshot captured")}>
                      <Camera className="h-4 w-4 mr-1" />Screenshot
                    </Button>
                    <Button size="sm" variant={isRecording ? "destructive" : "secondary"} onClick={() => setIsRecording(!isRecording)}>
                      <Video className="h-4 w-4 mr-1" />{isRecording ? "Stop" : "Record"}
                    </Button>
                    <Button size="sm" variant="secondary"><Maximize className="h-4 w-4" /></Button>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-white">
                    <Monitor className="mx-auto h-16 w-16 opacity-50" />
                    <p className="mt-4 text-lg">Computer is Offline</p>
                    {computer.lastSeen && (
                      <p className="mt-1 text-sm opacity-75">Last seen {formatDistanceToNow(new Date(computer.lastSeen), { addSuffix: true })}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Tabs for detailed data */}
          <Tabs defaultValue="activity" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" />Activity</TabsTrigger>
              <TabsTrigger value="keylogger"><Keyboard className="h-4 w-4 mr-1" />Keylogger</TabsTrigger>
              <TabsTrigger value="clipboard"><Clipboard className="h-4 w-4 mr-1" />Clipboard</TabsTrigger>
              <TabsTrigger value="processes"><Cpu className="h-4 w-4 mr-1" />Processes</TabsTrigger>
              <TabsTrigger value="firewall"><Shield className="h-4 w-4 mr-1" />Firewall</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card>
                <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {computer.activities.map((activity) => (
                        <div key={activity.id} className="flex items-center gap-2 p-2 rounded border">
                          <Badge variant="outline" className={
                            activity.category === "productive" ? "border-green-500 text-green-500" :
                            activity.category === "unproductive" ? "border-red-500 text-red-500" : "border-yellow-500 text-yellow-500"
                          }>{activity.type}</Badge>
                          <span className="flex-1 truncate">{activity.title}</span>
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.startedAt), { addSuffix: true })}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="keylogger">
              <Card>
                <CardHeader>
                  <CardTitle>Captured Keystrokes</CardTitle>
                  <CardDescription>Recent keyboard activity from this computer</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {keylogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No keylogs captured</div>
                    ) : (
                      <div className="space-y-2">
                        {keylogs.map((log) => (
                          <div key={log.id} className="p-3 rounded border">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline">{log.application}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.capturedAt), { addSuffix: true })}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">{log.windowTitle}</p>
                            <code className="text-sm bg-muted p-1 rounded block">{log.keystrokes}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clipboard">
              <Card>
                <CardHeader>
                  <CardTitle>Clipboard History</CardTitle>
                  <CardDescription>Copied content from this computer</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {clipboardLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No clipboard data</div>
                    ) : (
                      <div className="space-y-2">
                        {clipboardLogs.map((log) => (
                          <div key={log.id} className="p-3 rounded border">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline"><FileText className="h-3 w-3 mr-1" />{log.contentType}</Badge>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(log.content); toast.success("Copied"); }}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.capturedAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                            <p className="text-sm truncate">{log.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="processes">
              <Card>
                <CardHeader>
                  <CardTitle>Running Processes ({processes.length})</CardTitle>
                  <CardDescription>Click on a process to terminate it</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Process</TableHead>
                          <TableHead>PID</TableHead>
                          <TableHead>CPU</TableHead>
                          <TableHead>Memory</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processes.slice(0, 20).map((proc) => (
                          <TableRow key={`${proc.processId}-${proc.processName}`}>
                            <TableCell className="font-medium">{proc.processName}</TableCell>
                            <TableCell>{proc.processId}</TableCell>
                            <TableCell>{(proc.cpuUsage || 0).toFixed(1)}%</TableCell>
                            <TableCell>{(proc.memoryUsage || 0).toFixed(1)}%</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setKillDialog({ open: true, process: proc })}>
                                <Skull className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="firewall">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Firewall Rules</CardTitle>
                    <CardDescription>Network access control for this computer</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setFirewallDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />Add Rule
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {firewallRules.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No firewall rules configured</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rule</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Port</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {firewallRules.map((rule) => (
                            <TableRow key={rule.id}>
                              <TableCell className="font-medium">{rule.name}</TableCell>
                              <TableCell><Badge variant="outline">{rule.direction}</Badge></TableCell>
                              <TableCell>
                                <Badge variant={rule.action === "BLOCK" ? "destructive" : "default"}>{rule.action}</Badge>
                              </TableCell>
                              <TableCell>{rule.port || "*"}</TableCell>
                              <TableCell>
                                <Switch checked={rule.isActive} onCheckedChange={() => toggleFirewallRule(rule)} />
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteFirewallRule(rule.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* System Stats */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">System Resources</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />CPU</span>
                  <span>{stats.cpuUsage.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${stats.cpuUsage > 80 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${stats.cpuUsage}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" />Memory</span>
                  <span>{stats.memoryUsage.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${stats.memoryUsage > 80 ? "bg-orange-500" : "bg-blue-500"}`} style={{ width: `${stats.memoryUsage}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />Disk</span>
                  <span>{stats.diskUsage.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${stats.diskUsage > 90 ? "bg-red-500" : "bg-purple-500"}`} style={{ width: `${stats.diskUsage}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">System Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{computer.osType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{computer.ipAddress || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span>{computer.hostname}</span>
              </div>
            </CardContent>
          </Card>

          {/* Remote Control */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Remote Control</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" size="sm" disabled={computer.status !== "ONLINE"}>
                <Eye className="h-4 w-4 mr-2" />View Only
              </Button>
              <Button className="w-full justify-start" variant="outline" size="sm" disabled={computer.status !== "ONLINE"}>
                <MousePointer2 className="h-4 w-4 mr-2" />Take Control
              </Button>
              <Button className="w-full justify-start" variant="outline" size="sm" disabled={computer.status !== "ONLINE"}>
                <Terminal className="h-4 w-4 mr-2" />Remote Shell
              </Button>
            </CardContent>
          </Card>

          {/* Command History */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Command History</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {commands.map((cmd) => (
                    <div key={cmd.id} className="flex items-center gap-2 text-xs">
                      {getStatusIcon(cmd.status)}
                      <Badge variant="outline" className="text-xs">{cmd.command}</Badge>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(cmd.createdAt), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Confirm {confirmDialog.label}</DialogTitle>
            <DialogDescription>Are you sure you want to {confirmDialog.label.toLowerCase()} this computer?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, command: "", label: "" })}>Cancel</Button>
            <Button variant="destructive" onClick={() => sendCommand(confirmDialog.command)} disabled={sending}>{sending ? "Sending..." : `Yes, ${confirmDialog.label}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>Display a popup message on the computer</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Enter message..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>Cancel</Button>
            <Button onClick={() => { sendCommand("MESSAGE", { message }); setMessage(""); setMessageDialog(false); }} disabled={!message.trim()}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={executeDialog} onOpenChange={setExecuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Command</DialogTitle>
            <DialogDescription>Run a command on the remote computer</DialogDescription>
          </DialogHeader>
          <Input placeholder="e.g., notepad.exe" value={executeCommand} onChange={(e) => setExecuteCommand(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteDialog(false)}>Cancel</Button>
            <Button onClick={() => { sendCommand("EXECUTE", { command: executeCommand }); setExecuteCommand(""); setExecuteDialog(false); }} disabled={!executeCommand.trim()}>Execute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={killDialog.open} onOpenChange={(open) => setKillDialog({ ...killDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Skull className="h-5 w-5 text-red-500" />Kill Process</DialogTitle>
            <DialogDescription>Terminate {killDialog.process?.processName} (PID: {killDialog.process?.processId})?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillDialog({ open: false, process: null })}>Cancel</Button>
            <Button variant="destructive" onClick={() => killDialog.process && killProcess(killDialog.process)}>Kill Process</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={firewallDialog} onOpenChange={setFirewallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Firewall Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input placeholder="e.g., Block Social Media" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Direction</Label>
                <Select value={newRule.direction} onValueChange={(v) => setNewRule({ ...newRule, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INBOUND">Inbound</SelectItem>
                    <SelectItem value="OUTBOUND">Outbound</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action</Label>
                <Select value={newRule.action} onValueChange={(v) => setNewRule({ ...newRule, action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLOCK">Block</SelectItem>
                    <SelectItem value="ALLOW">Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Protocol</Label>
                <Select value={newRule.protocol} onValueChange={(v) => setNewRule({ ...newRule, protocol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="UDP">UDP</SelectItem>
                    <SelectItem value="ANY">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Port</Label>
                <Input placeholder="e.g., 80, 443" value={newRule.port} onChange={(e) => setNewRule({ ...newRule, port: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirewallDialog(false)}>Cancel</Button>
            <Button onClick={createFirewallRule} disabled={!newRule.name}>Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
