import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  Bell,
  CheckCircle,
  Shield,
  Clock,
  Wifi,
} from "lucide-react";
import { format } from "date-fns";

async function getAlerts() {
  return prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      computer: {
        select: { name: true },
      },
    },
  });
}

async function getAlertStats() {
  const [total, unread, policyViolations, idleAlerts] = await Promise.all([
    prisma.alert.count(),
    prisma.alert.count({ where: { isRead: false } }),
    prisma.alert.count({ where: { type: "POLICY_VIOLATION" } }),
    prisma.alert.count({ where: { type: "IDLE" } }),
  ]);
  return { total, unread, policyViolations, idleAlerts };
}

export default async function AlertsPage() {
  const [alerts, stats] = await Promise.all([getAlerts(), getAlertStats()]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "POLICY_VIOLATION":
        return <Shield className="h-4 w-4 text-red-500" />;
      case "IDLE":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "OFFLINE":
        return <Wifi className="h-4 w-4 text-gray-500" />;
      case "SUSPICIOUS":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case "POLICY_VIOLATION":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "IDLE":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "OFFLINE":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "SUSPICIOUS":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            Monitor and manage system alerts and notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Mark All as Read</Button>
          <Button variant="outline">Clear All</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unread
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{stats.unread}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Policy Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.policyViolations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Idle Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.idleAlerts}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Alerts</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="policy">Policy Violations</TabsTrigger>
              <TabsTrigger value="idle">Idle</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Computer</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id} className={alert.isRead ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.type)}
                      <Badge variant="outline" className={getAlertBadgeColor(alert.type)}>
                        {alert.type.replace("_", " ")}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {alert.message}
                  </TableCell>
                  <TableCell>{alert.computer?.name || "System"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(alert.createdAt), "PPp")}
                  </TableCell>
                  <TableCell>
                    {alert.isRead ? (
                      <Badge variant="secondary">Read</Badge>
                    ) : (
                      <Badge>Unread</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
