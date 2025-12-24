import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/commands/[id] - Get a specific command
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

    const command = await prisma.deviceCommand.findFirst({
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
          },
        },
      },
    });

    if (!command) {
      return NextResponse.json(
        { error: "Command not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(command);
  } catch (error) {
    console.error("Error fetching command:", error);
    return NextResponse.json(
      { error: "Failed to fetch command" },
      { status: 500 }
    );
  }
}

// PATCH /api/commands/[id] - Update command status (for agent callback)
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
    const { status, response } = body;

    const command = await prisma.deviceCommand.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!command) {
      return NextResponse.json(
        { error: "Command not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status.toUpperCase();
      if (status.toUpperCase() === "SENT") {
        updateData.sentAt = new Date();
      } else if (status.toUpperCase() === "EXECUTED") {
        updateData.executedAt = new Date();
      }
    }

    if (response !== undefined) {
      updateData.response = response;
    }

    const updatedCommand = await prisma.deviceCommand.update({
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

    return NextResponse.json(updatedCommand);
  } catch (error) {
    console.error("Error updating command:", error);
    return NextResponse.json(
      { error: "Failed to update command" },
      { status: 500 }
    );
  }
}

// DELETE /api/commands/[id] - Delete a command
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const command = await prisma.deviceCommand.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!command) {
      return NextResponse.json(
        { error: "Command not found" },
        { status: 404 }
      );
    }

    await prisma.deviceCommand.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting command:", error);
    return NextResponse.json(
      { error: "Failed to delete command" },
      { status: 500 }
    );
  }
}
