import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/processes - List processes for a computer
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const live = searchParams.get("live") === "true";
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!computerId) {
      return NextResponse.json(
        { error: "computerId is required" },
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

    if (live) {
      // Get the most recent processes (latest snapshot)
      const latestLog = await prisma.processLog.findFirst({
        where: { computerId },
        orderBy: { capturedAt: "desc" },
        select: { capturedAt: true },
      });

      if (!latestLog) {
        return NextResponse.json([]);
      }

      const processes = await prisma.processLog.findMany({
        where: {
          computerId,
          capturedAt: latestLog.capturedAt,
        },
        orderBy: { cpuUsage: "desc" },
        take: limit,
      });

      return NextResponse.json(processes);
    } else {
      // Get historical processes
      const processes = await prisma.processLog.findMany({
        where: { computerId },
        orderBy: { capturedAt: "desc" },
        take: limit,
      });

      return NextResponse.json(processes);
    }
  } catch (error) {
    console.error("Error fetching processes:", error);
    return NextResponse.json(
      { error: "Failed to fetch processes" },
      { status: 500 }
    );
  }
}

// POST /api/processes - Log processes (from agent)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { computerId, processes } = body;

    if (!computerId || !processes || !Array.isArray(processes)) {
      return NextResponse.json(
        { error: "computerId and processes array are required" },
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

    const capturedAt = new Date();

    const processLogs = await prisma.processLog.createMany({
      data: processes.map((p: {
        processName: string;
        processId: number;
        path?: string;
        cpuUsage?: number;
        memoryUsage?: number;
        username?: string;
        startedAt?: string;
      }) => ({
        computerId,
        processName: p.processName,
        processId: p.processId,
        path: p.path,
        cpuUsage: p.cpuUsage,
        memoryUsage: p.memoryUsage,
        username: p.username,
        startedAt: p.startedAt ? new Date(p.startedAt) : null,
        capturedAt,
      })),
    });

    return NextResponse.json({ created: processLogs.count }, { status: 201 });
  } catch (error) {
    console.error("Error logging processes:", error);
    return NextResponse.json(
      { error: "Failed to log processes" },
      { status: 500 }
    );
  }
}
