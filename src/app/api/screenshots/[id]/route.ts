import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/screenshots/[id] - Get a single screenshot
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const screenshot = await prisma.screenshot.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        computer: true,
      },
    });

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }

    return NextResponse.json(screenshot);
  } catch (error) {
    console.error("Error fetching screenshot:", error);
    return NextResponse.json(
      { error: "Failed to fetch screenshot" },
      { status: 500 }
    );
  }
}

// DELETE /api/screenshots/[id] - Delete a screenshot
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.screenshot.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }

    // Remove file from disk if it exists
    if (existing.filePath) {
      try { await unlink(existing.filePath); } catch {}
    }

    await prisma.screenshot.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting screenshot:", error);
    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    );
  }
}
