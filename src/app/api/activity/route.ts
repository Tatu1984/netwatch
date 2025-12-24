import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/activity - List activity logs
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      computer: {
        organizationId: session.user.organizationId,
      },
    };

    if (computerId) {
      where.computerId = computerId;
    }

    if (type && type !== "all") {
      where.type = type.toUpperCase();
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        (where.startedAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.startedAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          computer: {
            select: {
              id: true,
              name: true,
              hostname: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + activities.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// POST /api/activity - Log activity (from agent)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { computerId, type, title, details, duration, startedAt, endedAt } = body;

    if (!computerId || !type || !title) {
      return NextResponse.json(
        { error: "computerId, type, and title are required" },
        { status: 400 }
      );
    }

    const validTypes = ["APPLICATION", "WEBSITE", "IDLE", "ACTIVE"];
    if (!validTypes.includes(type.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid type. Must be APPLICATION, WEBSITE, IDLE, or ACTIVE" },
        { status: 400 }
      );
    }

    // Verify computer belongs to organization
    const computer = await prisma.computer.findFirst({
      where: {
        id: computerId,
        organizationId: session.user.organizationId,
      },
    });

    if (!computer) {
      return NextResponse.json({ error: "Computer not found" }, { status: 404 });
    }

    const activity = await prisma.activityLog.create({
      data: {
        computerId,
        type: type.toUpperCase(),
        title,
        details,
        duration: duration || 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
      },
      include: {
        computer: {
          select: {
            id: true,
            name: true,
            hostname: true,
          },
        },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return NextResponse.json(
      { error: "Failed to create activity log" },
      { status: 500 }
    );
  }
}
