import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/remote-sessions/[id] - Get a specific session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const remoteSession = await prisma.remoteSession.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        computer: {
          select: {
            id: true,
            name: true,
            hostname: true,
            status: true,
            ipAddress: true,
            osType: true,
          },
        },
      },
    });

    if (!remoteSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(remoteSession);
  } catch (error) {
    console.error("Error fetching remote session:", error);
    return NextResponse.json(
      { error: "Failed to fetch remote session" },
      { status: 500 }
    );
  }
}

// PATCH /api/remote-sessions/[id] - Update session status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const remoteSession = await prisma.remoteSession.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!remoteSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status.toUpperCase();
      if (status.toUpperCase() === "ENDED") {
        updateData.endedAt = new Date();
      }
    }

    const updatedSession = await prisma.remoteSession.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Error updating remote session:", error);
    return NextResponse.json(
      { error: "Failed to update remote session" },
      { status: 500 }
    );
  }
}

// DELETE /api/remote-sessions/[id] - End/terminate a session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const remoteSession = await prisma.remoteSession.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!remoteSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // End the session rather than delete it
    const updatedSession = await prisma.remoteSession.update({
      where: { id },
      data: {
        status: "ENDED",
        endedAt: new Date(),
      },
    });

    // Notify the agent to end the session
    await prisma.deviceCommand.create({
      data: {
        computerId: remoteSession.computerId,
        command: "END_REMOTE_SESSION",
        payload: JSON.stringify({ sessionId: id }),
        status: "PENDING",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Error ending remote session:", error);
    return NextResponse.json(
      { error: "Failed to end remote session" },
      { status: 500 }
    );
  }
}
