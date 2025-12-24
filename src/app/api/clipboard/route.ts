import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/clipboard - List clipboard logs
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and MANAGER can view clipboard logs
    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const contentType = searchParams.get("contentType");
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

    if (contentType && contentType !== "all") {
      where.contentType = contentType.toUpperCase();
    }

    if (startDate || endDate) {
      where.capturedAt = {};
      if (startDate) {
        (where.capturedAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.capturedAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.clipboardLog.findMany({
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
        orderBy: { capturedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.clipboardLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching clipboard logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch clipboard logs" },
      { status: 500 }
    );
  }
}

// POST /api/clipboard - Create clipboard log entry (from agent)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { computerId, contentType, content, application } = body;

    if (!computerId || !contentType || !content) {
      return NextResponse.json(
        { error: "computerId, contentType, and content are required" },
        { status: 400 }
      );
    }

    // Verify the computer belongs to the organization
    const computer = await prisma.computer.findFirst({
      where: {
        id: computerId,
        organizationId: session.user.organizationId,
      },
    });

    if (!computer) {
      return NextResponse.json(
        { error: "Computer not found" },
        { status: 404 }
      );
    }

    const log = await prisma.clipboardLog.create({
      data: {
        computerId,
        contentType: contentType.toUpperCase(),
        content,
        application,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating clipboard log:", error);
    return NextResponse.json(
      { error: "Failed to create clipboard log" },
      { status: 500 }
    );
  }
}

// DELETE /api/clipboard - Delete clipboard logs (bulk)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const olderThan = searchParams.get("olderThan"); // days

    const where: Record<string, unknown> = {
      computer: {
        organizationId: session.user.organizationId,
      },
    };

    if (computerId) {
      where.computerId = computerId;
    }

    if (olderThan) {
      const days = parseInt(olderThan);
      const date = new Date();
      date.setDate(date.getDate() - days);
      where.capturedAt = { lt: date };
    }

    const result = await prisma.clipboardLog.deleteMany({ where });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting clipboard logs:", error);
    return NextResponse.json(
      { error: "Failed to delete clipboard logs" },
      { status: 500 }
    );
  }
}
