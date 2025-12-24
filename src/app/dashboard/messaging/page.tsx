"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Monitor,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock
} from "lucide-react";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  status: string;
  group?: { name: string };
}

interface Message {
  id: string;
  title: string;
  content: string;
  type: string;
  lockScreen: boolean;
  targetType: string;
  targetIds: string[];
  sentAt: string;
  status: string;
  responses: number;
}

export default function MessagingPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedComputers, setSelectedComputers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Message form state
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageType, setMessageType] = useState<"info" | "warning" | "alert">("info");
  const [lockScreen, setLockScreen] = useState(false);
  const [duration, setDuration] = useState("0");

  useEffect(() => {
    fetchComputers();
    fetchMessages();
  }, []);

  const fetchComputers = async () => {
    try {
      const res = await fetch("/api/computers");
      const data = await res.json();
      setComputers(data);
    } catch (error) {
      console.error("Error fetching computers:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedComputers(computers.filter(c => c.status === "ONLINE").map(c => c.id));
    } else {
      setSelectedComputers([]);
    }
  };

  const handleSelectComputer = (computerId: string, checked: boolean) => {
    if (checked) {
      setSelectedComputers([...selectedComputers, computerId]);
    } else {
      setSelectedComputers(selectedComputers.filter(id => id !== computerId));
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (selectedComputers.length === 0) {
      toast.error("Please select at least one computer");
      return;
    }

    setLoading(true);
    try {
      // Send message command to each selected computer
      for (const computerId of selectedComputers) {
        await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            computerId,
            command: "MESSAGE",
            payload: {
              title: messageTitle || "Message from Administrator",
              message: messageContent,
              type: messageType,
              lockScreen,
              duration: parseInt(duration) * 1000,
            },
          }),
        });
      }

      toast.success(`Message sent to ${selectedComputers.length} computer(s)`);

      // Reset form
      setMessageTitle("");
      setMessageContent("");
      setMessageType("info");
      setLockScreen(false);
      setDuration("0");
      setSelectedComputers([]);
      setSelectAll(false);
      setDialogOpen(false);

      fetchMessages();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const onlineComputers = computers.filter(c => c.status === "ONLINE");
  const offlineComputers = computers.filter(c => c.status !== "ONLINE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messaging</h1>
          <p className="text-muted-foreground">
            Send messages to employee computers
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Message to Computers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder="Message title"
                />
              </div>

              <div className="space-y-2">
                <Label>Message Content</Label>
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Message Type</Label>
                  <Select value={messageType} onValueChange={(v: "info" | "warning" | "alert") => setMessageType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Information</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="alert">Alert (Urgent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Auto-dismiss (seconds)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Never (manual close)</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lockScreen"
                  checked={lockScreen}
                  onCheckedChange={(checked) => setLockScreen(checked as boolean)}
                />
                <Label htmlFor="lockScreen" className="flex items-center">
                  <Lock className="mr-2 h-4 w-4" />
                  Lock screen while displaying message
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Target Computers ({selectedComputers.length} selected)</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  <div className="p-2 border-b bg-muted/50">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="selectAll"
                        checked={selectAll}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      />
                      <Label htmlFor="selectAll" className="text-sm font-medium">
                        Select all online computers ({onlineComputers.length})
                      </Label>
                    </div>
                  </div>
                  <div className="divide-y">
                    {computers.map((computer) => (
                      <div key={computer.id} className="flex items-center space-x-2 p-2">
                        <Checkbox
                          id={computer.id}
                          checked={selectedComputers.includes(computer.id)}
                          onCheckedChange={(checked) => handleSelectComputer(computer.id, checked as boolean)}
                          disabled={computer.status !== "ONLINE"}
                        />
                        <Label
                          htmlFor={computer.id}
                          className={`flex-1 text-sm ${computer.status !== "ONLINE" ? "text-muted-foreground" : ""}`}
                        >
                          {computer.name}
                        </Label>
                        <Badge variant={computer.status === "ONLINE" ? "default" : "secondary"}>
                          {computer.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={loading || selectedComputers.length === 0}
                className="w-full"
              >
                {loading ? "Sending..." : `Send to ${selectedComputers.length} Computer(s)`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Computers</CardTitle>
            <Monitor className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineComputers.length}</div>
            <p className="text-xs text-muted-foreground">Available to receive messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline Computers</CardTitle>
            <Monitor className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offlineComputers.length}</div>
            <p className="text-xs text-muted-foreground">Currently unreachable</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages.filter(m =>
              new Date(m.sentAt).toDateString() === new Date().toDateString()
            ).length}</div>
            <p className="text-xs text-muted-foreground">Across all computers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(computers.map(c => c.group?.name).filter(Boolean)).size}
            </div>
            <p className="text-xs text-muted-foreground">Computer groups</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Send Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => {
          setMessageType("info");
          setMessageContent("Please remember to save your work regularly.");
          setDialogOpen(true);
        }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <MessageSquare className="mr-2 h-5 w-5 text-blue-500" />
              Quick Reminder
            </CardTitle>
            <CardDescription>Send a friendly reminder to save work</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => {
          setMessageType("warning");
          setMessageContent("System maintenance scheduled. Please save your work and log off within the next 15 minutes.");
          setLockScreen(false);
          setDialogOpen(true);
        }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
              Maintenance Notice
            </CardTitle>
            <CardDescription>Notify about scheduled maintenance</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => {
          setMessageType("alert");
          setMessageContent("URGENT: Please stop all work immediately and contact IT department.");
          setLockScreen(true);
          setDialogOpen(true);
        }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <XCircle className="mr-2 h-5 w-5 text-red-500" />
              Emergency Alert
            </CardTitle>
            <CardDescription>Send urgent alert with screen lock</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Command History</CardTitle>
          <CardDescription>Messages and commands sent to computers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Command</TableHead>
                <TableHead>Computer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No messages sent yet
                  </TableCell>
                </TableRow>
              ) : (
                messages.slice(0, 10).map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-medium">{msg.title || msg.type}</TableCell>
                    <TableCell>{msg.targetIds?.length || 1} computer(s)</TableCell>
                    <TableCell>
                      <Badge variant={msg.status === "EXECUTED" ? "default" : msg.status === "FAILED" ? "destructive" : "secondary"}>
                        {msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(msg.sentAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
