"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Loader2,
  Search,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  color: string;
}

interface DiscoveredDevice {
  ip: string;
  hostname: string | null;
  mac: string | null;
  status: "online" | "offline";
  responseTime: number | null;
}

interface ConnectivityTest {
  name: string;
  status: "success" | "failed" | "warning";
  message: string;
  details?: string;
}

interface TestResult {
  ip: string;
  hostname: string | null;
  overallStatus: "ready" | "partial" | "unreachable";
  tests: ConnectivityTest[];
}

interface AddComputerDialogProps {
  groups: Group[];
}

export function AddComputerDialog({ groups }: AddComputerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    hostname: "",
    ipAddress: "",
    osType: "windows",
    groupId: "",
  });

  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const resetForm = () => {
    setFormData({
      name: "",
      hostname: "",
      ipAddress: "",
      osType: "windows",
      groupId: "",
    });
    setDiscoveredDevices([]);
    setSelectedDevice(null);
    setTestResult(null);
    setActiveTab("manual");
  };

  // Network scan
  const handleScanNetwork = async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);

    try {
      const response = await fetch("/api/network/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to scan network");
      }

      const data = await response.json();
      setDiscoveredDevices(data.devices);

      if (data.devices.length === 0) {
        toast.info("No devices found on the network");
      } else {
        toast.success(`Found ${data.devices.length} devices`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  // Test connectivity
  const handleTestConnectivity = async (ip?: string) => {
    const testIp = ip || formData.ipAddress;
    if (!testIp) {
      toast.error("Please enter an IP address");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/network/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: testIp,
          osType: formData.osType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Connectivity test failed");
      }

      const result = await response.json();
      setTestResult(result);

      // Auto-fill hostname if found
      if (result.hostname && !formData.hostname) {
        setFormData((prev) => ({ ...prev, hostname: result.hostname }));
      }

      if (result.overallStatus === "ready") {
        toast.success("Computer is ready to be added");
      } else if (result.overallStatus === "partial") {
        toast.warning("Some connectivity issues detected");
      } else {
        toast.error("Computer is unreachable");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  // Select discovered device
  const handleSelectDevice = (device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setFormData({
      ...formData,
      name: device.hostname || `Computer-${device.ip.split(".")[3]}`,
      hostname: device.hostname || device.ip,
      ipAddress: device.ip,
    });
    setActiveTab("manual");
    handleTestConnectivity(device.ip);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/computers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          groupId: formData.groupId === "none" ? null : formData.groupId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add computer");
      }

      toast.success("Computer added successfully");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add computer");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
      case "ready":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning":
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "failed":
      case "unreachable":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Computer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Computer</DialogTitle>
          <DialogDescription>
            Add a computer manually or discover devices on your network.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="discover">Network Discovery</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Scan your local network for available computers
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanNetwork}
                disabled={isScanning}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Scan Network
                  </>
                )}
              </Button>
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-2">
              {discoveredDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Wifi className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">
                    {isScanning ? "Scanning network..." : "Click 'Scan Network' to discover devices"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {discoveredDevices.map((device) => (
                    <div
                      key={device.ip}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedDevice?.ip === device.ip ? "border-primary bg-muted/50" : ""
                      }`}
                      onClick={() => handleSelectDevice(device)}
                    >
                      <div className="flex items-center gap-3">
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {device.hostname || `Unknown (${device.ip})`}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{device.ip}</span>
                            {device.mac && <span>• {device.mac}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {device.responseTime && (
                          <Badge variant="secondary" className="text-xs">
                            {device.responseTime}ms
                          </Badge>
                        )}
                        {device.status === "online" ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., John's Workstation"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hostname">Hostname</Label>
                  <Input
                    id="hostname"
                    placeholder="e.g., DESKTOP-ABC123"
                    value={formData.hostname}
                    onChange={(e) =>
                      setFormData({ ...formData, hostname: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ipAddress"
                      placeholder="e.g., 192.168.1.100"
                      value={formData.ipAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, ipAddress: e.target.value })
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleTestConnectivity()}
                      disabled={isTesting || !formData.ipAddress}
                      title="Test Connectivity"
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Connectivity Test Results */}
                {testResult && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Connectivity Test</span>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(testResult.overallStatus)}
                        <span className="text-xs capitalize">{testResult.overallStatus}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {testResult.tests.map((test, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground">{test.name}</span>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(test.status)}
                            <span>{test.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="osType">Operating System</Label>
                    <Select
                      value={formData.osType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, osType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="windows">Windows</SelectItem>
                        <SelectItem value="macos">macOS</SelectItem>
                        <SelectItem value="linux">Linux</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="group">Group</Label>
                    <Select
                      value={formData.groupId || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, groupId: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Group</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: group.color }}
                              />
                              {group.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Computer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
