import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/file-transfers/[id] - Get a specific transfer
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

    const transfer = await prisma.fileTransfer.findFirst({
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
          },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transfer);
  } catch (error) {
    console.error("Error fetching file transfer:", error);
    return NextResponse.json(
      { error: "Failed to fetch file transfer" },
      { status: 500 }
    );
  }
}

// PATCH /api/file-transfers/[id] - Update transfer status/progress
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
    const { status, progress } = body;

    const transfer = await prisma.fileTransfer.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status.toUpperCase();
      if (status.toUpperCase() === "COMPLETED") {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      }
    }

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    const updatedTransfer = await prisma.fileTransfer.update({
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

    return NextResponse.json(updatedTransfer);
  } catch (error) {
    console.error("Error updating file transfer:", error);
    return NextResponse.json(
      { error: "Failed to update file transfer" },
      { status: 500 }
    );
  }
}

// DELETE /api/file-transfers/[id] - Cancel a transfer
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

    const transfer = await prisma.fileTransfer.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    // Only cancel if not completed
    if (transfer.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot cancel a completed transfer" },
        { status: 400 }
      );
    }

    // Update status to failed/cancelled
    await prisma.fileTransfer.update({
      where: { id },
      data: { status: "FAILED" },
    });

    // Create a command to cancel the transfer on the agent
    await prisma.deviceCommand.create({
      data: {
        computerId: transfer.computerId,
        command: "CANCEL_TRANSFER",
        payload: JSON.stringify({ transferId: id }),
        status: "PENDING",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling file transfer:", error);
    return NextResponse.json(
      { error: "Failed to cancel file transfer" },
      { status: 500 }
    );
  }
}
