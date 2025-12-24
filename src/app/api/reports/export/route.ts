import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReport, ReportData, ReportFormat } from "@/lib/report-generator";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get("type") || "activity";
    const formatType = (searchParams.get("format") || "pdf") as ReportFormat;
    const computerId = searchParams.get("computerId");
    const days = parseInt(searchParams.get("days") || "7", 10);

    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(new Date(), days));

    let reportData: ReportData;

    switch (reportType) {
      case "activity":
        reportData = await generateActivityReport(computerId, startDate, endDate);
        break;
      case "applications":
        reportData = await generateApplicationsReport(computerId, startDate, endDate);
        break;
      case "websites":
        reportData = await generateWebsitesReport(computerId, startDate, endDate);
        break;
      case "productivity":
        reportData = await generateProductivityReport(computerId, startDate, endDate);
        break;
      case "keystrokes":
        reportData = await generateKeystrokesReport(computerId, startDate, endDate);
        break;
      case "commands":
        reportData = await generateCommandsReport(computerId, startDate, endDate);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    const result = await generateReport(reportData, formatType);

    const contentType = {
      pdf: "application/pdf",
      csv: "text/csv",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[formatType];

    const extension = formatType;
    const filename = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.${extension}`;

    return new NextResponse(result, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

async function generateActivityReport(computerId: string | null, startDate: Date, endDate: Date): Promise<ReportData> {
  const where = {
    startTime: { gte: startDate, lte: endDate },
    ...(computerId && { computerId }),
  };

  const activities = await prisma.activityLog.findMany({
    where,
    include: { computer: { select: { name: true, hostname: true } } },
    orderBy: { startTime: "desc" },
    take: 1000,
  });

  const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);

  return {
    title: "Activity Report",
    subtitle: computerId ? `Computer: ${activities[0]?.computer.name || "Unknown"}` : "All Computers",
    generatedAt: new Date(),
    columns: [
      { key: "computer", header: "Computer", width: 100 },
      { key: "application", header: "Application", width: 120 },
      { key: "windowTitle", header: "Window Title", width: 150 },
      { key: "category", header: "Category", width: 80 },
      { key: "duration", header: "Duration (min)", width: 80 },
      { key: "startTime", header: "Start Time", width: 120 },
    ],
    rows: activities.map(a => ({
      computer: a.computer.name,
      application: a.applicationName,
      windowTitle: a.windowTitle.substring(0, 50),
      category: a.category || "Other",
      duration: Math.round(a.duration / 60000),
      startTime: a.startTime,
    })),
    summary: {
      "Total Activities": activities.length,
      "Total Duration": `${Math.round(totalDuration / 3600000)} hours`,
      "Period": `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`,
    },
  };
}

async function generateApplicationsReport(computerId: string | null, startDate: Date, endDate: Date): Promise<ReportData> {
  const where = {
    startTime: { gte: startDate, lte: endDate },
    ...(computerId && { computerId }),
  };

  const activities = await prisma.activityLog.findMany({
    where,
    select: { applicationName: true, duration: true, category: true },
  });

  // Aggregate by application
  const appStats = new Map<string, { duration: number; count: number; category: string }>();

  for (const activity of activities) {
    const existing = appStats.get(activity.applicationName) || { duration: 0, count: 0, category: activity.category || "Other" };
    existing.duration += activity.duration;
    existing.count += 1;
    appStats.set(activity.applicationName, existing);
  }

  const sortedApps = Array.from(appStats.entries())
    .sort((a, b) => b[1].duration - a[1].duration)
    .slice(0, 50);

  const totalDuration = sortedApps.reduce((sum, [, stats]) => sum + stats.duration, 0);

  return {
    title: "Application Usage Report",
    subtitle: `Top 50 Applications`,
    generatedAt: new Date(),
    columns: [
      { key: "rank", header: "#", width: 30 },
      { key: "application", header: "Application", width: 150 },
      { key: "category", header: "Category", width: 100 },
      { key: "sessions", header: "Sessions", width: 70 },
      { key: "duration", header: "Duration (hours)", width: 100 },
      { key: "percentage", header: "% of Total", width: 70 },
    ],
    rows: sortedApps.map(([app, stats], index) => ({
      rank: index + 1,
      application: app,
      category: stats.category,
      sessions: stats.count,
      duration: (stats.duration / 3600000).toFixed(1),
      percentage: totalDuration > 0 ? ((stats.duration / totalDuration) * 100).toFixed(1) + "%" : "0%",
    })),
    summary: {
      "Total Applications": appStats.size,
      "Total Usage Time": `${Math.round(totalDuration / 3600000)} hours`,
    },
  };
}

async function generateWebsitesReport(computerId: string | null, startDate: Date, endDate: Date): Promise<ReportData> {
  const where = {
    visitedAt: { gte: startDate, lte: endDate },
    ...(computerId && { computerId }),
  };

  const websites = await prisma.websiteLog.findMany({
    where,
    include: { computer: { select: { name: true } } },
    orderBy: { visitedAt: "desc" },
    take: 500,
  });

  // Aggregate by domain
  const domainStats = new Map<string, { visits: number; duration: number }>();

  for (const site of websites) {
    try {
      const url = new URL(site.url);
      const domain = url.hostname;
      const existing = domainStats.get(domain) || { visits: 0, duration: 0 };
      existing.visits += 1;
      existing.duration += site.duration;
      domainStats.set(domain, existing);
    } catch {
      // Invalid URL
    }
  }

  const sortedDomains = Array.from(domainStats.entries())
    .sort((a, b) => b[1].visits - a[1].visits)
    .slice(0, 50);

  return {
    title: "Website Browsing Report",
    subtitle: "Top 50 Websites by Visits",
    generatedAt: new Date(),
    columns: [
      { key: "rank", header: "#", width: 30 },
      { key: "domain", header: "Website", width: 200 },
      { key: "visits", header: "Visits", width: 70 },
      { key: "duration", header: "Time Spent (min)", width: 100 },
    ],
    rows: sortedDomains.map(([domain, stats], index) => ({
      rank: index + 1,
      domain,
      visits: stats.visits,
      duration: Math.round(stats.duration / 60),
    })),
    summary: {
      "Total Websites": domainStats.size,
      "Total Page Views": websites.length,
    },
  };
}

async function generateProductivityReport(computerId: string | null, startDate: Date, endDate: Date): Promise<ReportData> {
  const where = {
    startTime: { gte: startDate, lte: endDate },
    ...(computerId && { computerId }),
  };

  const activities = await prisma.activityLog.findMany({
    where,
    include: { computer: { select: { name: true } } },
  });

  // Categorize productivity
  const productiveCategories = ["DEVELOPMENT", "PRODUCTIVITY", "COMMUNICATION"];
  const unproductiveCategories = ["ENTERTAINMENT", "SOCIAL"];

  const computerStats = new Map<string, { productive: number; unproductive: number; neutral: number; total: number }>();

  for (const activity of activities) {
    const computer = activity.computer.name;
    const stats = computerStats.get(computer) || { productive: 0, unproductive: 0, neutral: 0, total: 0 };

    if (productiveCategories.includes(activity.category || "")) {
      stats.productive += activity.duration;
    } else if (unproductiveCategories.includes(activity.category || "")) {
      stats.unproductive += activity.duration;
    } else {
      stats.neutral += activity.duration;
    }
    stats.total += activity.duration;

    computerStats.set(computer, stats);
  }

  const rows = Array.from(computerStats.entries()).map(([computer, stats]) => ({
    computer,
    productive: (stats.productive / 3600000).toFixed(1),
    unproductive: (stats.unproductive / 3600000).toFixed(1),
    neutral: (stats.neutral / 3600000).toFixed(1),
    total: (stats.total / 3600000).toFixed(1),
    score: stats.total > 0 ? Math.round((stats.productive / stats.total) * 100) : 0,
  }));

  return {
    title: "Productivity Report",
    subtitle: `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`,
    generatedAt: new Date(),
    columns: [
      { key: "computer", header: "Computer", width: 120 },
      { key: "productive", header: "Productive (hrs)", width: 100 },
      { key: "unproductive", header: "Unproductive (hrs)", width: 100 },
      { key: "neutral", header: "Neutral (hrs)", width: 100 },
      { key: "total", header: "Total (hrs)", width: 80 },
      { key: "score", header: "Productivity %", width: 80 },
    ],
    rows,
    summary: {
      "Computers Analyzed": computerStats.size,
      "Average Productivity": rows.length > 0
        ? `${Math.round(rows.reduce((sum, r) => sum + (r.score as number), 0) / rows.length)}%`
        : "N/A",
    },
  };
}

async function generateKeystrokesReport(computerId: string | null, startDate: Date, endDate: Date): Promise<ReportData> {
  const where = {
    capturedAt: { gte: startDate, lte: endDate },
    ...(computerId && { computerId }),
  };

  const keylogs = await prisma.keylog.findMany({
    where,
    include: { computer: { select: { name: true } } },
    orderBy: { capturedAt: "desc" },
    take: 500,
  });

  return {
    title: "Keystroke Activity Report",
    subtitle: computerId ? "Single Computer" : "All Computers",
    generatedAt: new Date(),
    columns: [
      { key: "computer", header: "Computer", width: 100 },
      { key: "application", header: "Application", width: 120 },
      { key: "window", header: "Window", width: 150 },
      { key: "keystrokes", header: "Keystrokes", width: 200 },
      { key: "time", header: "Time", width: 120 },
    ],
    rows: keylogs.map(k => ({
      computer: k.computer.name,
      application: k.applicationName || "Unknown",
      window: (k.windowTitle || "Unknown").substring(0, 40),
      keystrokes: k.keystrokes.substring(0, 50) + (k.keystrokes.length > 50 ? "..." : ""),
      time: k.capturedAt,
    })),
    summary: {
      "Total Entries": keylogs.length,
    },
  };
}

async function generateCommandsReport(computerId: string | null, startDate: Date, endDate: Date): Promise<ReportData> {
  const where = {
    createdAt: { gte: startDate, lte: endDate },
    ...(computerId && { computerId }),
  };

  const commands = await prisma.deviceCommand.findMany({
    where,
    include: { computer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return {
    title: "Command History Report",
    subtitle: "Device Commands Executed",
    generatedAt: new Date(),
    columns: [
      { key: "computer", header: "Computer", width: 100 },
      { key: "command", header: "Command", width: 100 },
      { key: "status", header: "Status", width: 80 },
      { key: "sentAt", header: "Sent At", width: 120 },
      { key: "executedAt", header: "Executed At", width: 120 },
      { key: "response", header: "Response", width: 150 },
    ],
    rows: commands.map(c => ({
      computer: c.computer.name,
      command: c.command,
      status: c.status,
      sentAt: c.sentAt,
      executedAt: c.executedAt,
      response: c.response?.substring(0, 40) || "-",
    })),
    summary: {
      "Total Commands": commands.length,
      "Executed": commands.filter(c => c.status === "EXECUTED").length,
      "Failed": commands.filter(c => c.status === "FAILED").length,
      "Pending": commands.filter(c => c.status === "PENDING").length,
    },
  };
}
