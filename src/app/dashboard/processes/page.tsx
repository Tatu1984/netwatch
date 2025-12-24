"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Cpu,
  HardDrive,
  Laptop,
  RefreshCw,
  Search,
  Skull,
  AlertTriangle,
  Play,
  Pause,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  status: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: number | null;
}

interface ProcessLog {
  id: string;
  computerId: string;
  processName: string;
  processId: number;
  path: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  username: string | null;
  startedAt: string | null;
  capturedAt: string;
}

export default function ProcessesPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [processes, setProcesses] = useState<ProcessLog[]>([]);
  const [selectedComputer, setSelectedComputer] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [killDialog, setKillDialog] = useState<{ open: boolean; process: ProcessLog | null }>({
    open: false,
    process: null,
  });

  useEffect(() => {
    fetchComputers();
  }, []);

  useEffect(() => {
    if (selectedComputer) {
      fetchProcesses();
    }
  }, [selectedComputer]);

  useEffect(() => {
    if (!autoRefresh || !selectedComputer) return;
    const interval = setInterval(fetchProcesses, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedComputer]);

  async function fetchComputers() {
    try {
      const res = await fetch("/api/computers");
      if (res.ok) {
        const data = await res.json();
        setComputers(data);
        if (data.length > 0 && !selectedComputer) {
          setSelectedComputer(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch computers:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProcesses() {
    if (!selectedComputer) return;
    try {
      const res = await fetch(`/api/processes?computerId=${selectedComputer}&live=true`);
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
      }
    } catch (error) {
      console.error("Failed to fetch processes:", error);
    }
  }

  async function killProcess(process: ProcessLog) {
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          computerId: selectedComputer,
          command: "KILL_PROCESS",
          payload: {
            processId: process.processId,
            processName: process.processName,
          },
        }),
      });

      if (res.ok) {
        toast.success(`Kill command sent for ${process.processName}`);
        setKillDialog({ open: false, process: null });
        // Refresh processes after a short delay
        setTimeout(fetchProcesses, 2000);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to kill process");
      }
    } catch (error) {
      toast.error("Failed to kill process");
      console.error(error);
    }
  }

  const selectedComputerData = computers.find((c) => c.id === selectedComputer);

  const filteredProcesses = processes.filter((p) =>
    p.processName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.path && p.path.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.username && p.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedProcesses = [...filteredProcesses].sort(
    (a, b) => (b.cpuUsage || 0) - (a.cpuUsage || 0)
  );

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
            <Activity className="h-8 w-8" />
            Process Manager
          </h1>
          <p className="text-muted-foreground">
            View and manage running processes on remote computers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Auto-Refresh
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchProcesses}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Computer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5" />
            Select Computer
          </CardTitle>
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
                      <div className={`h-2 w-2 rounded-full ${computer.status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                      {computer.name} ({computer.hostname})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search processes..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Stats */}
      {selectedComputerData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant={selectedComputerData.status === "ONLINE" ? "default" : "secondary"}
                className={selectedComputerData.status === "ONLINE" ? "bg-green-500" : ""}
              >
                {selectedComputerData.status}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Cpu className="h-4 w-4" />
                CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {selectedComputerData.cpuUsage?.toFixed(1) || 0}%
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (selectedComputerData.cpuUsage || 0) > 80
                        ? "bg-red-500"
                        : (selectedComputerData.cpuUsage || 0) > 50
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${selectedComputerData.cpuUsage || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {selectedComputerData.memoryUsage?.toFixed(1) || 0}%
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (selectedComputerData.memoryUsage || 0) > 80
                        ? "bg-red-500"
                        : (selectedComputerData.memoryUsage || 0) > 50
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${selectedComputerData.memoryUsage || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <HardDrive className="h-4 w-4" />
                Disk Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {selectedComputerData.diskUsage?.toFixed(1) || 0}%
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (selectedComputerData.diskUsage || 0) > 90
                        ? "bg-red-500"
                        : (selectedComputerData.diskUsage || 0) > 70
                        ? "bg-yellow-500"
                        : "bg-purple-500"
                    }`}
                    style={{ width: `${selectedComputerData.diskUsage || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Process Table */}
      <Card>
        <CardHeader>
          <CardTitle>Running Processes ({sortedProcesses.length})</CardTitle>
          <CardDescription>
            {autoRefresh ? "Live updating every 5 seconds" : "Auto-refresh paused"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedComputer ? (
            <div className="text-center py-12 text-muted-foreground">
              <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a computer to view processes</p>
            </div>
          ) : sortedProcesses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No processes found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Process Name</TableHead>
                  <TableHead>PID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>CPU %</TableHead>
                  <TableHead>Memory %</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProcesses.map((process) => (
                  <TableRow key={`${process.processId}-${process.processName}`}>
                    <TableCell className="font-medium">{process.processName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{process.processId}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {process.username || "SYSTEM"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              (process.cpuUsage || 0) > 50 ? "bg-red-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(process.cpuUsage || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm">
                          {(process.cpuUsage || 0).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              (process.memoryUsage || 0) > 50 ? "bg-orange-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(process.memoryUsage || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm">
                          {(process.memoryUsage || 0).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-xs">
                      {process.path || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setKillDialog({ open: true, process })}
                      >
                        <Skull className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Kill Process Dialog */}
      <Dialog open={killDialog.open} onOpenChange={(open) => setKillDialog({ ...killDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Kill Process
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate this process?
            </DialogDescription>
          </DialogHeader>
          {killDialog.process && (
            <div className="space-y-2 py-4">
              <p>
                <strong>Process:</strong> {killDialog.process.processName}
              </p>
              <p>
                <strong>PID:</strong> {killDialog.process.processId}
              </p>
              {killDialog.process.path && (
                <p className="text-sm text-muted-foreground">
                  <strong>Path:</strong> {killDialog.process.path}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillDialog({ open: false, process: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => killDialog.process && killProcess(killDialog.process)}
            >
              <Skull className="h-4 w-4 mr-2" />
              Kill Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
