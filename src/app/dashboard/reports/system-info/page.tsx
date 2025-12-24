"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Clock,
  Download,
  RefreshCw,
} from "lucide-react";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  osType: string;
  osVersion: string;
  status: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: number | null;
  agentVersion: string;
  lastSeen: string;
  createdAt: string;
  group?: { name: string };
}

export default function SystemInfoReportsPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [selectedComputer, setSelectedComputer] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComputers();
  }, []);

  const fetchComputers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/computers");
      const data = await res.json();
      setComputers(data);
    } catch (error) {
      console.error("Error fetching computers:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredComputers = selectedComputer === "all"
    ? computers
    : computers.filter(c => c.id === selectedComputer);

  const getOSIcon = (osType: string) => {
    switch (osType?.toLowerCase()) {
      case "windows":
        return "🪟";
      case "macos":
      case "darwin":
        return "🍎";
      case "linux":
        return "🐧";
      default:
        return "💻";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const exportReport = (format: "csv" | "pdf") => {
    const params = new URLSearchParams({
      type: "system",
      format,
      ...(selectedComputer !== "all" && { computerId: selectedComputer }),
    });
    window.open(`/api/reports/export?${params}`, "_blank");
  };

  // Calculate summary stats
  const onlineCount = computers.filter(c => c.status === "ONLINE").length;
  const offlineCount = computers.filter(c => c.status !== "ONLINE").length;
  const avgCpu = computers.reduce((sum, c) => sum + (c.cpuUsage || 0), 0) / computers.length || 0;
  const avgMemory = computers.reduce((sum, c) => sum + (c.memoryUsage || 0), 0) / computers.length || 0;

  // OS distribution
  const osDistribution = computers.reduce((acc, c) => {
    const os = c.osType || "Unknown";
    acc[os] = (acc[os] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Information Report</h1>
          <p className="text-muted-foreground">
            Hardware and software inventory across all computers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchComputers}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => exportReport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => exportReport("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Computers</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{computers.length}</div>
            <p className="text-xs text-muted-foreground">
              {onlineCount} online, {offlineCount} offline
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCpu.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Across online computers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMemory.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Across online computers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OS Distribution</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(osDistribution).map(([os, count]) => (
                <Badge key={os} variant="outline" className="text-xs">
                  {getOSIcon(os)} {os}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Computer Filter</CardTitle>
            <Select value={selectedComputer} onValueChange={setSelectedComputer}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select computer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Computers</SelectItem>
                {computers.map((computer) => (
                  <SelectItem key={computer.id} value={computer.id}>
                    {computer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Detailed Report */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="software">Software</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
              <CardDescription>General system information for all computers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computer</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>Memory</TableHead>
                    <TableHead>Disk</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComputers.map((computer) => (
                    <TableRow key={computer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{computer.name}</div>
                          <div className="text-sm text-muted-foreground">{computer.hostname}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="mr-1">{getOSIcon(computer.osType)}</span>
                        {computer.osVersion || computer.osType}
                      </TableCell>
                      <TableCell>
                        <Badge variant={computer.status === "ONLINE" ? "default" : "secondary"}>
                          {computer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${(computer.cpuUsage || 0) > 80 ? "bg-red-500" : (computer.cpuUsage || 0) > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${computer.cpuUsage || 0}%` }}
                            />
                          </div>
                          <span className="text-sm">{computer.cpuUsage?.toFixed(1) || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${(computer.memoryUsage || 0) > 80 ? "bg-red-500" : (computer.memoryUsage || 0) > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${computer.memoryUsage || 0}%` }}
                            />
                          </div>
                          <span className="text-sm">{computer.memoryUsage?.toFixed(1) || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${(computer.diskUsage || 0) > 80 ? "bg-red-500" : (computer.diskUsage || 0) > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${computer.diskUsage || 0}%` }}
                            />
                          </div>
                          <span className="text-sm">{computer.diskUsage?.toFixed(1) || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {computer.lastSeen ? new Date(computer.lastSeen).toLocaleString() : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardware">
          <Card>
            <CardHeader>
              <CardTitle>Hardware Information</CardTitle>
              <CardDescription>CPU, Memory, and Disk specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computer</TableHead>
                    <TableHead>Operating System</TableHead>
                    <TableHead>OS Version</TableHead>
                    <TableHead>Agent Version</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComputers.map((computer) => (
                    <TableRow key={computer.id}>
                      <TableCell className="font-medium">{computer.name}</TableCell>
                      <TableCell>{computer.osType}</TableCell>
                      <TableCell>{computer.osVersion || "N/A"}</TableCell>
                      <TableCell>{computer.agentVersion || "N/A"}</TableCell>
                      <TableCell>{computer.group?.name || "Ungrouped"}</TableCell>
                      <TableCell>{new Date(computer.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network">
          <Card>
            <CardHeader>
              <CardTitle>Network Information</CardTitle>
              <CardDescription>IP addresses and MAC addresses</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computer</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComputers.map((computer) => (
                    <TableRow key={computer.id}>
                      <TableCell className="font-medium">{computer.name}</TableCell>
                      <TableCell>{computer.hostname}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {computer.ipAddress || "N/A"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {computer.macAddress || "N/A"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={computer.status === "ONLINE" ? "default" : "secondary"}>
                          {computer.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="software">
          <Card>
            <CardHeader>
              <CardTitle>Software Information</CardTitle>
              <CardDescription>Installed agent versions and configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computer</TableHead>
                    <TableHead>Agent Version</TableHead>
                    <TableHead>OS Type</TableHead>
                    <TableHead>OS Version</TableHead>
                    <TableHead>Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComputers.map((computer) => (
                    <TableRow key={computer.id}>
                      <TableCell className="font-medium">{computer.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          v{computer.agentVersion || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getOSIcon(computer.osType)} {computer.osType}
                      </TableCell>
                      <TableCell>{computer.osVersion || "N/A"}</TableCell>
                      <TableCell>
                        {computer.lastSeen ? new Date(computer.lastSeen).toLocaleString() : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
