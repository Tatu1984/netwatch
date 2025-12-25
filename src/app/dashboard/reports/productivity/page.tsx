"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Calendar, TrendingUp, TrendingDown, RefreshCw, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface DailyData {
  day: string;
  date: string;
  productive: number;
  neutral: number;
  unproductive: number;
  score: number;
  totalHours: number;
}

interface GroupData {
  name: string;
  score: number;
  activeHours: number;
  computerCount: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface ProductivityStats {
  overallScore: number;
  scoreChange: number;
  productiveHours: number;
  peakHour: string;
  idlePercentage: number;
  idleChange: number;
  totalComputers: number;
  activeComputers: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  DEVELOPMENT: "#22c55e",
  PRODUCTIVITY: "#3b82f6",
  COMMUNICATION: "#8b5cf6",
  ENTERTAINMENT: "#ef4444",
  SOCIAL: "#f97316",
  OTHER: "#6b7280",
};

export default function ProductivityReportPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");
  const [weeklyData, setWeeklyData] = useState<DailyData[]>([]);
  const [groupData, setGroupData] = useState<GroupData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [stats, setStats] = useState<ProductivityStats>({
    overallScore: 0,
    scoreChange: 0,
    productiveHours: 0,
    peakHour: "10 AM",
    idlePercentage: 0,
    idleChange: 0,
    totalComputers: 0,
    activeComputers: 0,
  });

  useEffect(() => {
    fetchProductivityData();
  }, [dateRange]);

  const fetchProductivityData = async () => {
    setLoading(true);
    try {
      const [activityRes, computersRes] = await Promise.all([
        fetch(`/api/reports/productivity?days=${dateRange}`),
        fetch("/api/computers"),
      ]);

      if (activityRes.ok) {
        const data = await activityRes.json();
        setWeeklyData(data.dailyData || []);
        setGroupData(data.groupData || []);
        setCategoryData(data.categoryData || []);
        setStats(data.stats || stats);
      } else {
        // Use calculated data if API not available
        await calculateFromActivityLogs();
      }

      const computers = await computersRes.json();
      setStats(prev => ({
        ...prev,
        totalComputers: computers.length,
        activeComputers: computers.filter((c: { status: string }) => c.status === "ONLINE").length,
      }));
    } catch (error) {
      console.error("Error fetching productivity data:", error);
      // Calculate from activity logs as fallback
      await calculateFromActivityLogs();
    } finally {
      setLoading(false);
    }
  };

  const calculateFromActivityLogs = async () => {
    try {
      const res = await fetch("/api/activity?limit=1000");
      if (!res.ok) return;

      const activities = await res.json();

      // Calculate daily data
      const days = parseInt(dateRange);
      const dailyMap = new Map<string, { productive: number; neutral: number; unproductive: number }>();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        dailyMap.set(key, { productive: 0, neutral: 0, unproductive: 0 });
      }

      let totalProductive = 0;
      let totalNeutral = 0;
      let totalUnproductive = 0;

      activities.forEach((activity: { startedAt: string; duration: number; category: string }) => {
        const date = new Date(activity.startedAt).toISOString().split("T")[0];
        const hours = (activity.duration || 0) / 3600000;

        if (dailyMap.has(date)) {
          const dayData = dailyMap.get(date)!;
          if (activity.category === "DEVELOPMENT" || activity.category === "PRODUCTIVITY") {
            dayData.productive += hours;
            totalProductive += hours;
          } else if (activity.category === "ENTERTAINMENT" || activity.category === "SOCIAL") {
            dayData.unproductive += hours;
            totalUnproductive += hours;
          } else {
            dayData.neutral += hours;
            totalNeutral += hours;
          }
        }
      });

      const calculatedDaily: DailyData[] = [];
      dailyMap.forEach((data, dateStr) => {
        const date = new Date(dateStr);
        const total = data.productive + data.neutral + data.unproductive;
        calculatedDaily.unshift({
          day: dayNames[date.getDay()],
          date: dateStr,
          productive: Math.round(data.productive * 10) / 10,
          neutral: Math.round(data.neutral * 10) / 10,
          unproductive: Math.round(data.unproductive * 10) / 10,
          score: total > 0 ? Math.round((data.productive / total) * 100) : 0,
          totalHours: Math.round(total * 10) / 10,
        });
      });

      setWeeklyData(calculatedDaily);

      // Calculate category breakdown
      const categoryMap = new Map<string, number>();
      activities.forEach((activity: { category: string; duration: number }) => {
        const cat = activity.category || "OTHER";
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + (activity.duration || 0) / 3600000);
      });

      const calcCategoryData: CategoryData[] = [];
      categoryMap.forEach((hours, category) => {
        calcCategoryData.push({
          name: category.charAt(0) + category.slice(1).toLowerCase(),
          value: Math.round(hours * 10) / 10,
          color: CATEGORY_COLORS[category] || "#6b7280",
        });
      });
      setCategoryData(calcCategoryData);

      // Calculate overall stats
      const totalHours = totalProductive + totalNeutral + totalUnproductive;
      const overallScore = totalHours > 0 ? Math.round((totalProductive / totalHours) * 100) : 0;
      const idlePercentage = totalHours > 0 ? Math.round((totalUnproductive / totalHours) * 100) : 0;

      setStats(prev => ({
        ...prev,
        overallScore,
        productiveHours: Math.round(totalProductive * 10) / 10,
        idlePercentage,
      }));
    } catch (error) {
      console.error("Error calculating from activity logs:", error);
    }
  };

  const exportReport = () => {
    const params = new URLSearchParams({
      type: "productivity",
      format: "pdf",
      days: dateRange,
    });
    window.open(`/api/reports/export?${params}`, "_blank");
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productivity Analytics</h1>
          <p className="text-muted-foreground">
            Analyze productivity trends and team performance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="14">Last 14 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchProductivityData}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.overallScore}%</p>
            {stats.scoreChange !== 0 && (
              <div className={`flex items-center text-xs ${stats.scoreChange > 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.scoreChange > 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                {stats.scoreChange > 0 ? "+" : ""}{stats.scoreChange}% from last period
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Productive Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.productiveHours}h</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalComputers > 0 ? `Avg ${(stats.productiveHours / stats.totalComputers).toFixed(1)}h per computer` : "Total across all computers"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Computers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.activeComputers}/{stats.totalComputers}</p>
            <p className="text-xs text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unproductive Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.idlePercentage}%</p>
            {stats.idleChange !== 0 && (
              <div className={`flex items-center text-xs ${stats.idleChange < 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.idleChange < 0 ? <TrendingDown className="mr-1 h-3 w-3" /> : <TrendingUp className="mr-1 h-3 w-3" />}
                {stats.idleChange > 0 ? "+" : ""}{stats.idleChange}% from last period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productivity Score Trend</CardTitle>
            <CardDescription>Daily productivity score over the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Distribution</CardTitle>
            <CardDescription>Hours by activity category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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
                />
                <Area
                  type="monotone"
                  dataKey="productive"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.6}
                  name="Productive"
                />
                <Area
                  type="monotone"
                  dataKey="neutral"
                  stackId="1"
                  stroke="#eab308"
                  fill="#eab308"
                  fillOpacity={0.6}
                  name="Neutral"
                />
                <Area
                  type="monotone"
                  dataKey="unproductive"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                  name="Unproductive"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Time distribution by activity category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}h`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value) => [`${value ?? 0}h`, "Hours"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group Performance</CardTitle>
            <CardDescription>Productivity by computer group</CardDescription>
          </CardHeader>
          <CardContent>
            {groupData.length > 0 ? (
              <div className="space-y-4">
                {groupData.map((group) => (
                  <div key={group.name} className="flex items-center gap-4">
                    <div className="w-32 font-medium truncate">{group.name}</div>
                    <div className="flex-1">
                      <div className="h-4 w-full rounded-full bg-muted">
                        <div
                          className="h-4 rounded-full bg-primary"
                          style={{ width: `${group.score}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right font-medium">{group.score}%</div>
                    <div className="w-20 text-right text-sm text-muted-foreground">
                      <Users className="inline-block h-3 w-3 mr-1" />
                      {group.computerCount}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No group data available. Create computer groups to see performance by group.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Activity Summary</CardTitle>
          <CardDescription>Total hours tracked each day</CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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
                  formatter={(value) => [`${value ?? 0}h`, ""]}
                />
                <Legend />
                <Bar
                  dataKey="productive"
                  stackId="a"
                  fill="#22c55e"
                  name="Productive"
                />
                <Bar
                  dataKey="neutral"
                  stackId="a"
                  fill="#eab308"
                  name="Neutral"
                />
                <Bar
                  dataKey="unproductive"
                  stackId="a"
                  fill="#ef4444"
                  name="Unproductive"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No activity data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
