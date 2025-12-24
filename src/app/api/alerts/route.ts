import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/alerts - List all alerts
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const severity = searchParams.get("severity");
    const isRead = searchParams.get("isRead");
    const computerId = searchParams.get("computerId");

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (type && type !== "all") {
      where.type = type;
    }

    if (severity && severity !== "all") {
      where.severity = severity.toUpperCase();
    }

    if (isRead !== null && isRead !== "all") {
      where.isRead = isRead === "true";
    }

    if (computerId) {
      where.computerId = computerId;
    }

    const alerts = await prisma.alert.findMany({
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
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

// POST /api/alerts - Create a new alert (typically from agent)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, severity, message, computerId, metadata } = body;

    if (!type || !message || !computerId) {
      return NextResponse.json(
        { error: "Type, message, and computerId are required" },
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

    const alert = await prisma.alert.create({
      data: {
        type,
        severity: severity || "MEDIUM",
        message,
        computerId,
        organizationId: session.user.organizationId,
        metadata: metadata ? JSON.stringify(metadata) : null,
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

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}

// PATCH /api/alerts - Bulk update alerts (mark as read)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { alertIds, isRead } = body;

    if (!alertIds || !Array.isArray(alertIds)) {
      return NextResponse.json(
        { error: "alertIds array is required" },
        { status: 400 }
      );
    }

    await prisma.alert.updateMany({
      where: {
        id: { in: alertIds },
        organizationId: session.user.organizationId,
      },
      data: { isRead: isRead ?? true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating alerts:", error);
    return NextResponse.json(
      { error: "Failed to update alerts" },
      { status: 500 }
    );
  }
}
