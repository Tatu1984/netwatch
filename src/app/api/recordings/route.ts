import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/recordings - List recordings
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
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
      where.startedAt = {};
      if (startDate) {
        (where.startedAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.startedAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    const [recordings, total, storageStats] = await Promise.all([
      prisma.recording.findMany({
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
        take: limit,
        skip: offset,
      }),
      prisma.recording.count({ where }),
      prisma.recording.aggregate({
        where: {
          computer: {
            organizationId: session.user.organizationId,
          },
        },
        _sum: {
          fileSize: true,
        },
      }),
    ]);

    return NextResponse.json({
      recordings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + recordings.length < total,
      },
      storage: {
        used: storageStats._sum.fileSize || 0,
        limit: 50 * 1024 * 1024 * 1024, // 50 GB limit
      },
    });
  } catch (error) {
    console.error("Error fetching recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}

// POST /api/recordings - Create a recording (from agent)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { computerId, videoUrl, filePath, fileName, fileSize, thumbnailUrl, duration, startedAt, endedAt, status } = body;

    if (!computerId) {
      return NextResponse.json(
        { error: "computerId is required" },
        { status: 400 }
      );
    }

    // Verify computer belongs to organization
    const computer = await prisma.computer.findFirst({
      where: {
        id: computerId,
        organizationId: session.user.organizationId,
      },
    });

    if (!computer) {
      return NextResponse.json({ error: "Computer not found" }, { status: 404 });
    }

    const recording = await prisma.recording.create({
      data: {
        computerId,
        videoUrl,
        filePath,
        fileName,
        fileSize: fileSize || 0,
        thumbnailUrl,
        status: status || "RECORDING",
        duration: duration || 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
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

    return NextResponse.json(recording, { status: 201 });
  } catch (error) {
    console.error("Error creating recording:", error);
    return NextResponse.json(
      { error: "Failed to create recording" },
      { status: 500 }
    );
  }
}

// Calculate storage statistics
async function getStorageStats(organizationId: string) {
  const stats = await prisma.recording.aggregate({
    where: {
      computer: {
        organizationId,
      },
    },
    _sum: {
      fileSize: true,
    },
    _count: true,
  });

  return {
    totalSize: stats._sum.fileSize || 0,
    totalCount: stats._count,
  };
}
