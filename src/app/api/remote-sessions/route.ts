import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/remote-sessions - List remote sessions
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const status = searchParams.get("status");
    const sessionType = searchParams.get("sessionType");

    const where: Record<string, unknown> = {
      computer: {
        organizationId: session.user.organizationId,
      },
    };

    if (computerId) {
      where.computerId = computerId;
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (sessionType && sessionType !== "all") {
      where.sessionType = sessionType.toUpperCase();
    }

    const sessions = await prisma.remoteSession.findMany({
      where,
      include: {
        computer: {
          select: {
            id: true,
            name: true,
            hostname: true,
            status: true,
            ipAddress: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching remote sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch remote sessions" },
      { status: 500 }
    );
  }
}

// POST /api/remote-sessions - Create a new remote session
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { computerId, sessionType } = body;

    if (!computerId || !sessionType) {
      return NextResponse.json(
        { error: "computerId and sessionType are required" },
        { status: 400 }
      );
    }

    // Validate session type
    const validTypes = ["VIEW", "CONTROL", "SHELL"];
    if (!validTypes.includes(sessionType.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid session type. Must be VIEW, CONTROL, or SHELL" },
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

    if (computer.status !== "ONLINE") {
      return NextResponse.json(
        { error: "Computer is not online" },
        { status: 400 }
      );
    }

    // Check for existing active session
    const existingSession = await prisma.remoteSession.findFirst({
      where: {
        computerId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
    });

    if (existingSession) {
      return NextResponse.json(
        { error: "An active session already exists for this computer", existingSession },
        { status: 409 }
      );
    }

    // Generate a session key for WebRTC signaling
    const sessionKey = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const remoteSession = await prisma.remoteSession.create({
      data: {
        computerId,
        userId: session.user.id,
        sessionType: sessionType.toUpperCase(),
        status: "PENDING",
        sessionKey,
      },
      include: {
        computer: {
          select: {
            id: true,
            name: true,
            hostname: true,
            ipAddress: true,
          },
        },
      },
    });

    // Create a command to notify the agent
    await prisma.deviceCommand.create({
      data: {
        computerId,
        command: "START_REMOTE_SESSION",
        payload: JSON.stringify({
          sessionId: remoteSession.id,
          sessionType: sessionType.toUpperCase(),
          sessionKey,
        }),
        status: "PENDING",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(remoteSession, { status: 201 });
  } catch (error) {
    console.error("Error creating remote session:", error);
    return NextResponse.json(
      { error: "Failed to create remote session" },
      { status: 500 }
    );
  }
}
