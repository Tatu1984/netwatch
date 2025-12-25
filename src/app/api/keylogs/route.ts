import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt, safeDecrypt } from "@/lib/encryption";

// GET /api/keylogs - List keylogs
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and MANAGER can view keylogs
    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const application = searchParams.get("application");
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

    if (startDate || endDate) {
      where.capturedAt = {};
      if (startDate) {
        (where.capturedAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.capturedAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { keystrokes: { contains: search } },
        { windowTitle: { contains: search } },
      ];
    }

    if (application) {
      where.application = { contains: application };
    }

    const [rawKeylogs, total] = await Promise.all([
      prisma.keylog.findMany({
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
      prisma.keylog.count({ where }),
    ]);

    // Decrypt keystrokes before returning
    const keylogs = rawKeylogs.map((keylog) => ({
      ...keylog,
      keystrokes: safeDecrypt(keylog.keystrokes),
    }));

    return NextResponse.json({
      keylogs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching keylogs:", error);
    return NextResponse.json(
      { error: "Failed to fetch keylogs" },
      { status: 500 }
    );
  }
}

// POST /api/keylogs - Create keylog entry (from agent)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { computerId, windowTitle, application, keystrokes } = body;

    if (!computerId || !keystrokes) {
      return NextResponse.json(
        { error: "computerId and keystrokes are required" },
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

    // Encrypt keystrokes before storing
    const encryptedKeystrokes = encrypt(keystrokes);

    const keylog = await prisma.keylog.create({
      data: {
        computerId,
        windowTitle,
        application,
        keystrokes: encryptedKeystrokes,
      },
    });

    return NextResponse.json({
      ...keylog,
      keystrokes, // Return unencrypted for immediate response
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating keylog:", error);
    return NextResponse.json(
      { error: "Failed to create keylog" },
      { status: 500 }
    );
  }
}

// DELETE /api/keylogs - Delete keylogs (bulk)
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

    const result = await prisma.keylog.deleteMany({ where });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting keylogs:", error);
    return NextResponse.json(
      { error: "Failed to delete keylogs" },
      { status: 500 }
    );
  }
}
