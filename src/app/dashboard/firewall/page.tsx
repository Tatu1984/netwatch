"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Ban,
  CheckCircle2,
  Laptop,
  Globe,
  Network,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  status: string;
}

interface FirewallRule {
  id: string;
  computerId: string;
  computer: { id: string; name: string; hostname: string };
  name: string;
  direction: string;
  action: string;
  protocol: string;
  port: string | null;
  remoteIp: string | null;
  application: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

const protocolOptions = ["TCP", "UDP", "ICMP", "ANY"];
const directionOptions = ["INBOUND", "OUTBOUND", "BOTH"];
const actionOptions = ["ALLOW", "BLOCK"];

export default function FirewallPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [selectedComputer, setSelectedComputer] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    computerId: "",
    name: "",
    direction: "INBOUND",
    action: "BLOCK",
    protocol: "TCP",
    port: "",
    remoteIp: "",
    application: "",
    priority: 100,
    isActive: true,
  });

  useEffect(() => {
    fetchComputers();
    fetchRules();
  }, [selectedComputer]);

  async function fetchComputers() {
    try {
      const res = await fetch("/api/computers");
      if (res.ok) {
        const data = await res.json();
        setComputers(data);
      }
    } catch (error) {
      console.error("Failed to fetch computers:", error);
    }
  }

  async function fetchRules() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedComputer !== "all") params.append("computerId", selectedComputer);

      const res = await fetch(`/api/firewall?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (error) {
      console.error("Failed to fetch rules:", error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingRule(null);
    setFormData({
      computerId: selectedComputer !== "all" ? selectedComputer : "",
      name: "",
      direction: "INBOUND",
      action: "BLOCK",
      protocol: "TCP",
      port: "",
      remoteIp: "",
      application: "",
      priority: 100,
      isActive: true,
    });
    setDialogOpen(true);
  }

  function openEditDialog(rule: FirewallRule) {
    setEditingRule(rule);
    setFormData({
      computerId: rule.computerId,
      name: rule.name,
      direction: rule.direction,
      action: rule.action,
      protocol: rule.protocol,
      port: rule.port || "",
      remoteIp: rule.remoteIp || "",
      application: rule.application || "",
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  }

  async function saveRule() {
    if (!formData.computerId || !formData.name) {
      toast.error("Computer and rule name are required");
      return;
    }

    setSaving(true);
    try {
      const url = editingRule ? `/api/firewall/${editingRule.id}` : "/api/firewall";
      const method = editingRule ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingRule ? "Rule updated successfully" : "Rule created successfully");
        setDialogOpen(false);
        fetchRules();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save rule");
      }
    } catch (error) {
      toast.error("Failed to save rule");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const res = await fetch(`/api/firewall/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Rule deleted successfully");
        fetchRules();
      } else {
        toast.error("Failed to delete rule");
      }
    } catch (error) {
      toast.error("Failed to delete rule");
      console.error(error);
    }
  }

  async function toggleRule(rule: FirewallRule) {
    try {
      const res = await fetch(`/api/firewall/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (res.ok) {
        toast.success(`Rule ${rule.isActive ? "disabled" : "enabled"}`);
        fetchRules();
      } else {
        toast.error("Failed to update rule");
      }
    } catch (error) {
      toast.error("Failed to update rule");
      console.error(error);
    }
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "INBOUND":
        return <ArrowDown className="h-4 w-4 text-blue-500" />;
      case "OUTBOUND":
        return <ArrowUp className="h-4 w-4 text-orange-500" />;
      case "BOTH":
        return <ArrowUpDown className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Firewall Management
          </h1>
          <p className="text-muted-foreground">
            Manage firewall rules for monitored computers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5" />
            Filter by Computer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedComputer} onValueChange={setSelectedComputer}>
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="All computers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Computers</SelectItem>
              {computers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${c.status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {rules.filter((r) => r.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Block Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {rules.filter((r) => r.action === "BLOCK").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allow Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {rules.filter((r) => r.action === "ALLOW").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Firewall Rules</CardTitle>
          <CardDescription>
            Rules are applied in priority order (lower number = higher priority)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No firewall rules configured</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Computer</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Remote IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.isActive ? "opacity-50" : ""}>
                    <TableCell>
                      <Badge variant="outline">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-muted-foreground" />
                        {rule.computer.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getDirectionIcon(rule.direction)}
                        <span className="text-sm">{rule.direction}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.action === "BLOCK" ? "destructive" : "default"}>
                        {rule.action === "BLOCK" ? (
                          <Ban className="h-3 w-3 mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {rule.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.protocol}</Badge>
                    </TableCell>
                    <TableCell>{rule.port || "*"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{rule.remoteIp || "*"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => toggleRule(rule)}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(rule)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add Firewall Rule"}</DialogTitle>
            <DialogDescription>
              Configure a firewall rule for the selected computer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Computer</Label>
                <Select
                  value={formData.computerId}
                  onValueChange={(v) => setFormData({ ...formData, computerId: v })}
                  disabled={!!editingRule}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select computer" />
                  </SelectTrigger>
                  <SelectContent>
                    {computers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g., Block Social Media"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Direction</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(v) => setFormData({ ...formData, direction: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {directionOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action</Label>
                <Select
                  value={formData.action}
                  onValueChange={(v) => setFormData({ ...formData, action: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionOptions.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Protocol</Label>
                <Select
                  value={formData.protocol}
                  onValueChange={(v) => setFormData({ ...formData, protocol: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {protocolOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Port (optional)</Label>
                <Input
                  placeholder="e.g., 80, 443, 8080-8090"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                />
              </div>
              <div>
                <Label>Remote IP (optional)</Label>
                <Input
                  placeholder="e.g., 192.168.1.1 or 10.0.0.0/8"
                  value={formData.remoteIp}
                  onChange={(e) => setFormData({ ...formData, remoteIp: e.target.value })}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div className="col-span-2">
                <Label>Application Path (optional)</Label>
                <Input
                  placeholder="e.g., C:\\Program Files\\App\\app.exe"
                  value={formData.application}
                  onChange={(e) => setFormData({ ...formData, application: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                />
                <Label>Enable rule immediately</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRule} disabled={saving}>
              {saving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
