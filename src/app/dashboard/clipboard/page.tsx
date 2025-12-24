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
  Clipboard,
  Search,
  Calendar,
  Laptop,
  FileText,
  Image as ImageIcon,
  File,
  Eye,
  Trash2,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Computer {
  id: string;
  name: string;
  hostname: string;
}

interface ClipboardLog {
  id: string;
  computerId: string;
  computer: { id: string; name: string; hostname: string };
  contentType: string;
  content: string;
  application: string | null;
  capturedAt: string;
}

export default function ClipboardPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [logs, setLogs] = useState<ClipboardLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedComputer, setSelectedComputer] = useState<string>("all");
  const [contentType, setContentType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ClipboardLog | null>(null);
  const limit = 50;

  useEffect(() => {
    fetchComputers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedComputer, contentType, dateFrom, dateTo, offset]);

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

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedComputer !== "all") params.append("computerId", selectedComputer);
      if (contentType !== "all") params.append("contentType", contentType);
      if (dateFrom) params.append("startDate", dateFrom);
      if (dateTo) params.append("endDate", dateTo);
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const res = await fetch(`/api/clipboard?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch clipboard logs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteLogs() {
    if (!confirm("Are you sure you want to delete all clipboard logs? This action cannot be undone.")) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (selectedComputer !== "all") params.append("computerId", selectedComputer);

      const res = await fetch(`/api/clipboard?${params.toString()}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Deleted ${data.deleted} clipboard entries`);
        fetchLogs();
      } else {
        toast.error("Failed to delete logs");
      }
    } catch (error) {
      toast.error("Failed to delete logs");
      console.error(error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function exportLogs() {
    const data = logs.map((l) => ({
      computer: l.computer.name,
      type: l.contentType,
      application: l.application,
      content: l.content,
      timestamp: format(new Date(l.capturedAt), "yyyy-MM-dd HH:mm:ss"),
    }));

    const csv = [
      ["Computer", "Type", "Application", "Content", "Timestamp"].join(","),
      ...data.map((row) =>
        [
          `"${row.computer}"`,
          row.type,
          `"${row.application || ""}"`,
          `"${row.content.replace(/"/g, '""').substring(0, 500)}"`,
          row.timestamp,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clipboard-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported successfully");
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "TEXT":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "IMAGE":
        return <ImageIcon className="h-4 w-4 text-green-500" />;
      case "FILE":
        return <File className="h-4 w-4 text-orange-500" />;
      default:
        return <Clipboard className="h-4 w-4" />;
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clipboard className="h-8 w-8" />
            Clipboard Monitor
          </h1>
          <p className="text-muted-foreground">
            View clipboard activity from monitored computers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportLogs} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="destructive" onClick={deleteLogs} disabled={logs.length === 0}>
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
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={(v) => { setContentType(v); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TEXT">Text</SelectItem>
                  <SelectItem value="IMAGE">Image</SelectItem>
                  <SelectItem value="FILE">File</SelectItem>
                </SelectContent>
              </Select>
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
      <div className="grid gap-4 md:grid-cols-4">
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
              Text Copies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {logs.filter((l) => l.contentType === "TEXT").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Image Copies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {logs.filter((l) => l.contentType === "IMAGE").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              File Copies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {logs.filter((l) => l.contentType === "FILE").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clipboard Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clipboard Activity</CardTitle>
          <CardDescription>
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clipboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No clipboard entries found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Computer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Content Preview</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Captured At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{log.computer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {getTypeIcon(log.contentType)}
                          {log.contentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm">
                          {log.contentType === "TEXT"
                            ? log.content.substring(0, 100) + (log.content.length > 100 ? "..." : "")
                            : log.content}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.application || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(log.capturedAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {log.contentType === "TEXT" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(log.content)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Clipboard Entry Details</DialogTitle>
            <DialogDescription>
              Full clipboard content information
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Computer</Label>
                  <p className="font-medium">{selectedLog.computer.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Captured At</Label>
                  <p className="font-medium">
                    {format(new Date(selectedLog.capturedAt), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedLog.contentType)}
                    <span className="font-medium">{selectedLog.contentType}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Application</Label>
                  <p className="font-medium">{selectedLog.application || "N/A"}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-muted-foreground">Content</Label>
                  {selectedLog.contentType === "TEXT" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedLog.content)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-48">
                  <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap break-words font-mono">
                    {selectedLog.content}
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
