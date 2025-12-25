import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Category productivity weights
const CATEGORY_WEIGHTS: Record<string, number> = {
  DEVELOPMENT: 1.0,      // Highly productive
  PRODUCTIVITY: 0.9,     // Very productive
  COMMUNICATION: 0.6,    // Moderately productive
  OTHER: 0.3,            // Neutral
  SOCIAL: 0.1,           // Low productivity
  ENTERTAINMENT: 0.0,    // Unproductive
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7");
    const computerId = searchParams.get("computerId");
    const groupId = searchParams.get("groupId");

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const whereClause: Record<string, unknown> = {
      startTime: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (computerId) {
      whereClause.computerId = computerId;
    }

    if (groupId) {
      whereClause.computer = {
        groupId: groupId,
      };
    }

    // Fetch activity logs
    const activities = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        computer: {
          include: {
            group: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // Calculate daily data
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyMap = new Map<string, {
      productive: number;
      neutral: number;
      unproductive: number;
      totalMs: number;
    }>();

    // Initialize all days in range
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const key = date.toISOString().split("T")[0];
      dailyMap.set(key, { productive: 0, neutral: 0, unproductive: 0, totalMs: 0 });
    }

    // Category breakdown
    const categoryMap = new Map<string, number>();

    // Group performance
    const groupMap = new Map<string, {
      productiveMs: number;
      totalMs: number;
      computerIds: Set<string>;
    }>();

    // Process activities
    let totalProductiveMs = 0;
    let totalNeutralMs = 0;
    let totalUnproductiveMs = 0;
    let totalMs = 0;

    // Hour of day tracking for peak hour
    const hourlyProductivity = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const activity of activities) {
      const dateKey = new Date(activity.startTime).toISOString().split("T")[0];
      const hour = new Date(activity.startTime).getHours();
      const durationMs = activity.duration || 0;
      const category = activity.category || "OTHER";
      const weight = CATEGORY_WEIGHTS[category] ?? 0.3;

      // Update daily data
      if (dailyMap.has(dateKey)) {
        const dayData = dailyMap.get(dateKey)!;
        dayData.totalMs += durationMs;

        if (weight >= 0.8) {
          dayData.productive += durationMs;
          totalProductiveMs += durationMs;
        } else if (weight >= 0.4) {
          dayData.neutral += durationMs;
          totalNeutralMs += durationMs;
        } else {
          dayData.unproductive += durationMs;
          totalUnproductiveMs += durationMs;
        }
      }

      totalMs += durationMs;

      // Update category breakdown
      categoryMap.set(category, (categoryMap.get(category) || 0) + durationMs);

      // Update hourly productivity
      hourlyProductivity[hour] += weight * durationMs;
      hourlyCounts[hour] += durationMs;

      // Update group data
      if (activity.computer?.group) {
        const groupName = activity.computer.group.name;
        if (!groupMap.has(groupName)) {
          groupMap.set(groupName, {
            productiveMs: 0,
            totalMs: 0,
            computerIds: new Set(),
          });
        }
        const groupData = groupMap.get(groupName)!;
        groupData.totalMs += durationMs;
        if (weight >= 0.8) {
          groupData.productiveMs += durationMs;
        }
        groupData.computerIds.add(activity.computerId);
      }
    }

    // Format daily data
    const dailyData = Array.from(dailyMap.entries()).map(([dateStr, data]) => {
      const date = new Date(dateStr);
      const totalHours = data.totalMs / 3600000;
      const score = data.totalMs > 0
        ? Math.round((data.productive / data.totalMs) * 100)
        : 0;

      return {
        day: dayNames[date.getDay()],
        date: dateStr,
        productive: Math.round((data.productive / 3600000) * 10) / 10,
        neutral: Math.round((data.neutral / 3600000) * 10) / 10,
        unproductive: Math.round((data.unproductive / 3600000) * 10) / 10,
        score,
        totalHours: Math.round(totalHours * 10) / 10,
      };
    });

    // Format category data
    const categoryColors: Record<string, string> = {
      DEVELOPMENT: "#22c55e",
      PRODUCTIVITY: "#3b82f6",
      COMMUNICATION: "#8b5cf6",
      ENTERTAINMENT: "#ef4444",
      SOCIAL: "#f97316",
      OTHER: "#6b7280",
    };

    const categoryData = Array.from(categoryMap.entries())
      .map(([category, ms]) => ({
        name: category.charAt(0) + category.slice(1).toLowerCase(),
        value: Math.round((ms / 3600000) * 10) / 10,
        color: categoryColors[category] || "#6b7280",
      }))
      .sort((a, b) => b.value - a.value);

    // Format group data
    const groupData = Array.from(groupMap.entries())
      .map(([name, data]) => ({
        name,
        score: data.totalMs > 0
          ? Math.round((data.productiveMs / data.totalMs) * 100)
          : 0,
        activeHours: Math.round((data.totalMs / 3600000) * 10) / 10,
        computerCount: data.computerIds.size,
      }))
      .sort((a, b) => b.score - a.score);

    // Calculate peak hour
    let peakHour = 10;
    let maxProductivity = 0;
    for (let h = 0; h < 24; h++) {
      if (hourlyCounts[h] > 0) {
        const avgProductivity = hourlyProductivity[h] / hourlyCounts[h];
        if (avgProductivity > maxProductivity) {
          maxProductivity = avgProductivity;
          peakHour = h;
        }
      }
    }

    // Get computer counts
    const computers = await prisma.computer.findMany({
      select: { id: true, status: true },
    });

    // Calculate overall stats
    const overallScore = totalMs > 0
      ? Math.round((totalProductiveMs / totalMs) * 100)
      : 0;

    // Get previous period for comparison
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);

    const prevActivities = await prisma.activityLog.findMany({
      where: {
        startTime: {
          gte: prevStartDate,
          lt: startDate,
        },
        ...(computerId ? { computerId } : {}),
        ...(groupId ? { computer: { groupId } } : {}),
      },
      select: {
        duration: true,
        category: true,
      },
    });

    let prevProductiveMs = 0;
    let prevUnproductiveMs = 0;
    let prevTotalMs = 0;

    for (const activity of prevActivities) {
      const durationMs = activity.duration || 0;
      const category = activity.category || "OTHER";
      const weight = CATEGORY_WEIGHTS[category] ?? 0.3;

      prevTotalMs += durationMs;
      if (weight >= 0.8) {
        prevProductiveMs += durationMs;
      } else if (weight < 0.4) {
        prevUnproductiveMs += durationMs;
      }
    }

    const prevScore = prevTotalMs > 0
      ? Math.round((prevProductiveMs / prevTotalMs) * 100)
      : 0;
    const prevIdlePercentage = prevTotalMs > 0
      ? Math.round((prevUnproductiveMs / prevTotalMs) * 100)
      : 0;

    const stats = {
      overallScore,
      scoreChange: prevScore > 0 ? overallScore - prevScore : 0,
      productiveHours: Math.round((totalProductiveMs / 3600000) * 10) / 10,
      peakHour: `${peakHour % 12 || 12} ${peakHour >= 12 ? "PM" : "AM"}`,
      idlePercentage: totalMs > 0
        ? Math.round((totalUnproductiveMs / totalMs) * 100)
        : 0,
      idleChange: prevIdlePercentage > 0
        ? Math.round((totalUnproductiveMs / totalMs) * 100) - prevIdlePercentage
        : 0,
      totalComputers: computers.length,
      activeComputers: computers.filter((c) => c.status === "ONLINE").length,
    };

    return NextResponse.json({
      dailyData,
      categoryData,
      groupData,
      stats,
    });
  } catch (error) {
    console.error("Error fetching productivity data:", error);
    return NextResponse.json(
      { error: "Failed to fetch productivity data" },
      { status: 500 }
    );
  }
}
