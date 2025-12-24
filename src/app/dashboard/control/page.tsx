"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Lock,
  Unlock,
  Power,
  RotateCcw,
  MessageSquare,
  LogOut,
  Moon,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Laptop,
  Send,
  History,
  Zap,
  MousePointer2,
  MousePointer2Off,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  status: string;
  isLocked: boolean;
  osType: string;
  group?: { name: string; color: string };
}

interface DeviceCommand {
  id: string;
  computerId: string;
  computer: { id: string; name: string; hostname: string };
  command: string;
  payload: string | null;
  status: string;
  sentAt: string | null;
  executedAt: string | null;
  response: string | null;
  createdAt: string;
}

const commandConfig = [
  { cmd: "LOCK", icon: Lock, label: "Lock Screen", color: "bg-yellow-500", description: "Lock the computer screen" },
  { cmd: "UNLOCK", icon: Unlock, label: "Unlock", color: "bg-green-500", description: "Unlock the computer screen" },
  { cmd: "SHUTDOWN", icon: Power, label: "Shutdown", color: "bg-red-500", description: "Shutdown the computer" },
  { cmd: "RESTART", icon: RotateCcw, label: "Restart", color: "bg-orange-500", description: "Restart the computer" },
  { cmd: "LOGOFF", icon: LogOut, label: "Log Off", color: "bg-purple-500", description: "Log off current user" },
  { cmd: "SLEEP", icon: Moon, label: "Sleep", color: "bg-blue-500", description: "Put computer to sleep" },
  { cmd: "BLOCK_INPUT", icon: MousePointer2Off, label: "Block Input", color: "bg-pink-500", description: "Block keyboard and mouse input" },
  { cmd: "UNBLOCK_INPUT", icon: MousePointer2, label: "Unblock Input", color: "bg-teal-500", description: "Unblock keyboard and mouse input" },
];

export default function DeviceControlPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [selectedComputer, setSelectedComputer] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [executeDialog, setExecuteDialog] = useState(false);
  const [message, setMessage] = useState("");
  const [executeCommand, setExecuteCommand] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; command: string; label: string }>({
    open: false,
    command: "",
    label: "",
  });

  useEffect(() => {
    fetchComputers();
    fetchCommands();
    const interval = setInterval(fetchCommands, 5000);
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

  async function fetchCommands() {
    try {
      const res = await fetch("/api/commands?limit=50");
      if (res.ok) {
        const data = await res.json();
        setCommands(data);
      }
    } catch (error) {
      console.error("Failed to fetch commands:", error);
    }
  }

  async function sendCommand(command: string, payload?: object) {
    if (!selectedComputer) {
      toast.error("Please select a computer first");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          computerId: selectedComputer,
          command,
          payload,
        }),
      });

      if (res.ok) {
        toast.success(`${command} command sent successfully`);
        fetchCommands();
        fetchComputers();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to send command");
      }
    } catch (error) {
      toast.error("Failed to send command");
      console.error(error);
    } finally {
      setSending(false);
      setConfirmDialog({ open: false, command: "", label: "" });
    }
  }

  async function sendMessage() {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    await sendCommand("MESSAGE", { message, title: "Message from Admin" });
    setMessage("");
    setMessageDialog(false);
  }

  async function sendExecuteCommand() {
    if (!executeCommand.trim()) {
      toast.error("Please enter a command");
      return;
    }
    await sendCommand("EXECUTE", { command: executeCommand });
    setExecuteCommand("");
    setExecuteDialog(false);
  }

  const selectedComputerData = computers.find((c) => c.id === selectedComputer);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "EXECUTED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "SENT":
        return <Send className="h-4 w-4 text-blue-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
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
      <div>
        <h1 className="text-3xl font-bold">Device Control</h1>
        <p className="text-muted-foreground">
          Send commands and control remote computers
        </p>
      </div>

      {/* Computer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5" />
            Select Computer
          </CardTitle>
          <CardDescription>Choose a computer to control</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedComputer} onValueChange={setSelectedComputer}>
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Select a computer..." />
            </SelectTrigger>
            <SelectContent>
              {computers.map((computer) => (
                <SelectItem key={computer.id} value={computer.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        computer.status === "ONLINE" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <span>{computer.name}</span>
                    <span className="text-muted-foreground text-xs">({computer.hostname})</span>
                    {computer.isLocked && (
                      <Lock className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedComputerData && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={selectedComputerData.status === "ONLINE" ? "default" : "secondary"}>
                {selectedComputerData.status}
              </Badge>
              <Badge variant="outline">{selectedComputerData.osType}</Badge>
              {selectedComputerData.isLocked && (
                <Badge variant="destructive" className="bg-yellow-500">
                  <Lock className="h-3 w-3 mr-1" /> Locked
                </Badge>
              )}
              {selectedComputerData.group && (
                <Badge style={{ backgroundColor: selectedComputerData.group.color, color: "white" }}>
                  {selectedComputerData.group.name}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>Common device control commands</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {commandConfig.map(({ cmd, icon: Icon, label, color, description }) => (
              <Button
                key={cmd}
                variant="outline"
                className="h-auto flex-col py-4 gap-2"
                disabled={!selectedComputer || sending}
                onClick={() => {
                  if (["SHUTDOWN", "RESTART", "LOCK"].includes(cmd)) {
                    setConfirmDialog({ open: true, command: cmd, label });
                  } else {
                    sendCommand(cmd);
                  }
                }}
              >
                <div className={`p-2 rounded-full ${color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-medium">{label}</span>
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              disabled={!selectedComputer || sending}
              onClick={() => setMessageDialog(true)}
            >
              <MessageSquare className="h-4 w-4" />
              Send Message
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!selectedComputer || sending}
              onClick={() => setExecuteDialog(true)}
            >
              <Terminal className="h-4 w-4" />
              Execute Command
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Command History
          </CardTitle>
          <CardDescription>Recent commands sent to devices</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Computer</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Executed At</TableHead>
                <TableHead>Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No commands sent yet
                  </TableCell>
                </TableRow>
              ) : (
                commands.map((cmd) => (
                  <TableRow key={cmd.id}>
                    <TableCell className="font-medium">{cmd.computer.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{cmd.command}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cmd.status)}
                        <span className="text-sm">{cmd.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {cmd.sentAt
                        ? formatDistanceToNow(new Date(cmd.sentAt), { addSuffix: true })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {cmd.executedAt
                        ? formatDistanceToNow(new Date(cmd.executedAt), { addSuffix: true })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {cmd.response || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm {confirmDialog.label}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmDialog.label.toLowerCase()} this computer?
              {confirmDialog.command === "SHUTDOWN" && " This will turn off the computer."}
              {confirmDialog.command === "RESTART" && " This will restart the computer."}
              {confirmDialog.command === "LOCK" && " This will lock the screen."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, command: "", label: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => sendCommand(confirmDialog.command)}
              disabled={sending}
            >
              {sending ? "Sending..." : `Yes, ${confirmDialog.label}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send a popup message to the selected computer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendMessage} disabled={sending || !message.trim()}>
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execute Command Dialog */}
      <Dialog open={executeDialog} onOpenChange={setExecuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Command</DialogTitle>
            <DialogDescription>
              Execute a command on the selected computer (use with caution)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="command">Command</Label>
              <Input
                id="command"
                placeholder="e.g., notepad.exe or calc"
                value={executeCommand}
                onChange={(e) => setExecuteCommand(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendExecuteCommand} disabled={sending || !executeCommand.trim()}>
              {sending ? "Executing..." : "Execute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
