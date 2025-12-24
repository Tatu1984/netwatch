import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/commands - List all device commands
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

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

    const commands = await prisma.deviceCommand.findMany({
      where,
      include: {
        computer: {
          select: {
            id: true,
            name: true,
            hostname: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(commands);
  } catch (error) {
    console.error("Error fetching commands:", error);
    return NextResponse.json(
      { error: "Failed to fetch commands" },
      { status: 500 }
    );
  }
}

// POST /api/commands - Create a new device command
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
    const { computerId, command, payload } = body;

    if (!computerId || !command) {
      return NextResponse.json(
        { error: "computerId and command are required" },
        { status: 400 }
      );
    }

    // Validate the command type
    const validCommands = ["LOCK", "UNLOCK", "SHUTDOWN", "RESTART", "MESSAGE", "LOGOFF", "SLEEP", "EXECUTE", "KILL_PROCESS", "BLOCK_INPUT", "UNBLOCK_INPUT"];
    if (!validCommands.includes(command.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid command type" },
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

    // Create the command
    const deviceCommand = await prisma.deviceCommand.create({
      data: {
        computerId,
        command: command.toUpperCase(),
        payload: payload ? JSON.stringify(payload) : null,
        status: "PENDING",
        createdBy: session.user.id,
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

    // If it's a lock command, update the computer's locked status
    if (command.toUpperCase() === "LOCK") {
      await prisma.computer.update({
        where: { id: computerId },
        data: { isLocked: true },
      });
    } else if (command.toUpperCase() === "UNLOCK") {
      await prisma.computer.update({
        where: { id: computerId },
        data: { isLocked: false },
      });
    }

    // Create an alert for critical commands
    if (["SHUTDOWN", "RESTART", "LOCK"].includes(command.toUpperCase())) {
      await prisma.alert.create({
        data: {
          type: "COMMAND_EXECUTED",
          message: `${command.toUpperCase()} command sent to ${computer.name}`,
          computerId,
          organizationId: session.user.organizationId,
        },
      });
    }

    return NextResponse.json(deviceCommand, { status: 201 });
  } catch (error) {
    console.error("Error creating command:", error);
    return NextResponse.json(
      { error: "Failed to create command" },
      { status: 500 }
    );
  }
}
