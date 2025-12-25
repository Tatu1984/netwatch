import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/policies - List all blocking policies
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (type && type !== "all") {
      where.type = type.toUpperCase();
    }

    if (isActive !== null && isActive !== "all") {
      where.isActive = isActive === "true";
    }

    const policies = await prisma.blockRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(policies);
  } catch (error) {
    console.error("Error fetching policies:", error);
    return NextResponse.json(
      { error: "Failed to fetch policies" },
      { status: 500 }
    );
  }
}

// POST /api/policies - Create a new blocking policy
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
    const { type, pattern, action, groupIds, isActive } = body;

    if (!type || !pattern) {
      return NextResponse.json(
        { error: "Type and pattern are required" },
        { status: 400 }
      );
    }

    const validTypes = ["WEBSITE", "APP"];
    if (!validTypes.includes(type.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid type. Must be WEBSITE or APP" },
        { status: 400 }
      );
    }

    const policy = await prisma.blockRule.create({
      data: {
        type: type.toUpperCase(),
        pattern,
        action: action || "BLOCK",
        groupIds,
        isActive: isActive ?? true,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    console.error("Error creating policy:", error);
    return NextResponse.json(
      { error: "Failed to create policy" },
      { status: 500 }
    );
  }
}
