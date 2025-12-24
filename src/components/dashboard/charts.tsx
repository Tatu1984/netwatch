"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Mon", productive: 6.5, neutral: 1.5, unproductive: 0.8 },
  { name: "Tue", productive: 7.2, neutral: 1.2, unproductive: 0.5 },
  { name: "Wed", productive: 6.8, neutral: 1.8, unproductive: 0.9 },
  { name: "Thu", productive: 7.5, neutral: 1.0, unproductive: 0.4 },
  { name: "Fri", productive: 6.2, neutral: 2.0, unproductive: 1.2 },
  { name: "Sat", productive: 2.1, neutral: 1.5, unproductive: 0.3 },
  { name: "Sun", productive: 1.8, neutral: 0.8, unproductive: 0.2 },
];

export function DashboardCharts() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorUnproductive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}h`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--popover-foreground))",
          }}
          formatter={(value: number) => [`${value}h`, ""]}
        />
        <Area
          type="monotone"
          dataKey="productive"
          stackId="1"
          stroke="hsl(var(--chart-1))"
          fill="url(#colorProductive)"
          name="Productive"
        />
        <Area
          type="monotone"
          dataKey="neutral"
          stackId="1"
          stroke="hsl(var(--chart-2))"
          fill="url(#colorNeutral)"
          name="Neutral"
        />
        <Area
          type="monotone"
          dataKey="unproductive"
          stackId="1"
          stroke="hsl(var(--chart-5))"
          fill="url(#colorUnproductive)"
          name="Unproductive"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
