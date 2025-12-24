import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Get all stats in parallel
    const [
      totalComputers,
      onlineComputers,
      offlineComputers,
      totalGroups,
      totalAlerts,
      unreadAlerts,
      todayScreenshots,
      todayActivity,
      activePolicies,
    ] = await Promise.all([
      prisma.computer.count({ where: { organizationId } }),
      prisma.computer.count({ where: { organizationId, status: "ONLINE" } }),
      prisma.computer.count({ where: { organizationId, status: "OFFLINE" } }),
      prisma.computerGroup.count({ where: { organizationId } }),
      prisma.alert.count({ where: { organizationId } }),
      prisma.alert.count({ where: { organizationId, isRead: false } }),
      prisma.screenshot.count({
        where: {
          computer: { organizationId },
          capturedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.activityLog.count({
        where: {
          computer: { organizationId },
          startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.blockRule.count({ where: { organizationId, isActive: true } }),
    ]);

    // Get recent activity summary
    const recentAlerts = await prisma.alert.findMany({
      where: { organizationId },
      include: {
        computer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Get productivity metrics for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activityByType = await prisma.activityLog.groupBy({
      by: ["type"],
      where: {
        computer: { organizationId },
        startedAt: { gte: todayStart },
      },
      _sum: { duration: true },
      _count: true,
    });

    return NextResponse.json({
      computers: {
        total: totalComputers,
        online: onlineComputers,
        offline: offlineComputers,
      },
      groups: totalGroups,
      alerts: {
        total: totalAlerts,
        unread: unreadAlerts,
      },
      today: {
        screenshots: todayScreenshots,
        activities: todayActivity,
      },
      policies: {
        active: activePolicies,
      },
      recentAlerts,
      activityByType: activityByType.map((item) => ({
        type: item.type,
        count: item._count,
        totalDuration: item._sum.duration || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
