"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Download, Calendar, ExternalLink } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const websiteData = [
  { name: "github.com", hours: 89, category: "productive" },
  { name: "stackoverflow.com", hours: 45, category: "productive" },
  { name: "docs.google.com", hours: 38, category: "productive" },
  { name: "figma.com", hours: 32, category: "productive" },
  { name: "twitter.com", hours: 28, category: "unproductive" },
  { name: "youtube.com", hours: 24, category: "unproductive" },
  { name: "linkedin.com", hours: 18, category: "neutral" },
  { name: "reddit.com", hours: 15, category: "unproductive" },
];

export default function WebsitesReportPage() {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "productive":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "unproductive":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Website Usage</h1>
          <p className="text-muted-foreground">
            Detailed breakdown of web browsing activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Last 7 Days
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Browsing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">289h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">156</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Productive Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">68%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">23</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Visited Websites</CardTitle>
          <CardDescription>Hours spent on each website</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={websiteData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value) => [`${value ?? 0} hours`, "Usage"]}
              />
              <Bar dataKey="hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Website Details</CardTitle>
          <CardDescription>Complete browsing history breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Avg. Duration</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websiteData.map((site) => (
                <TableRow key={site.name}>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getCategoryColor(site.category)}>
                      {site.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{site.hours}h</TableCell>
                  <TableCell>{Math.floor(Math.random() * 500) + 100}</TableCell>
                  <TableCell>{Math.floor(Math.random() * 10) + 2}m</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
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
