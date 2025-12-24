import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/computers/[id] - Get a single computer
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const computer = await prisma.computer.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        group: true,
        activityLogs: {
          take: 50,
          orderBy: { startedAt: "desc" },
        },
        screenshots: {
          take: 20,
          orderBy: { capturedAt: "desc" },
        },
        alerts: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!computer) {
      return NextResponse.json({ error: "Computer not found" }, { status: 404 });
    }

    return NextResponse.json(computer);
  } catch (error) {
    console.error("Error fetching computer:", error);
    return NextResponse.json(
      { error: "Failed to fetch computer" },
      { status: 500 }
    );
  }
}

// PUT /api/computers/[id] - Update a computer
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, hostname, ipAddress, osType, groupId, status } = body;

    // Verify computer belongs to organization
    const existing = await prisma.computer.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Computer not found" }, { status: 404 });
    }

    const computer = await prisma.computer.update({
      where: { id },
      data: {
        name,
        hostname,
        ipAddress,
        osType,
        groupId,
        status,
      },
      include: { group: true },
    });

    return NextResponse.json(computer);
  } catch (error) {
    console.error("Error updating computer:", error);
    return NextResponse.json(
      { error: "Failed to update computer" },
      { status: 500 }
    );
  }
}

// DELETE /api/computers/[id] - Delete a computer
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify computer belongs to organization
    const existing = await prisma.computer.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Computer not found" }, { status: 404 });
    }

    await prisma.computer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting computer:", error);
    return NextResponse.json(
      { error: "Failed to delete computer" },
      { status: 500 }
    );
  }
}
