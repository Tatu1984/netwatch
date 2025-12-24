import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/file-transfers - List file transfers
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");

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

    if (direction && direction !== "all") {
      where.direction = direction.toUpperCase();
    }

    const transfers = await prisma.fileTransfer.findMany({
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
    });

    return NextResponse.json(transfers);
  } catch (error) {
    console.error("Error fetching file transfers:", error);
    return NextResponse.json(
      { error: "Failed to fetch file transfers" },
      { status: 500 }
    );
  }
}

// POST /api/file-transfers - Create a new file transfer
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
    const { computerId, direction, localPath, remotePath, fileName, fileSize } = body;

    if (!computerId || !direction || !localPath || !remotePath || !fileName) {
      return NextResponse.json(
        { error: "computerId, direction, localPath, remotePath, and fileName are required" },
        { status: 400 }
      );
    }

    // Validate direction
    const validDirections = ["UPLOAD", "DOWNLOAD"];
    if (!validDirections.includes(direction.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid direction. Must be UPLOAD or DOWNLOAD" },
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

    const transfer = await prisma.fileTransfer.create({
      data: {
        computerId,
        direction: direction.toUpperCase(),
        localPath,
        remotePath,
        fileName,
        fileSize: fileSize || 0,
        status: "PENDING",
        initiatedBy: session.user.id,
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

    // Create a command to initiate the transfer
    await prisma.deviceCommand.create({
      data: {
        computerId,
        command: direction.toUpperCase() === "UPLOAD" ? "RECEIVE_FILE" : "SEND_FILE",
        payload: JSON.stringify({
          transferId: transfer.id,
          localPath,
          remotePath,
          fileName,
        }),
        status: "PENDING",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error("Error creating file transfer:", error);
    return NextResponse.json(
      { error: "Failed to create file transfer" },
      { status: 500 }
    );
  }
}
