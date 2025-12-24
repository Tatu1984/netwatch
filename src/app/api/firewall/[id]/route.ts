import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/firewall/[id] - Get a specific firewall rule
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

    const rule = await prisma.firewallRule.findFirst({
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

    if (!rule) {
      return NextResponse.json(
        { error: "Firewall rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error fetching firewall rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch firewall rule" },
      { status: 500 }
    );
  }
}

// PUT /api/firewall/[id] - Update a firewall rule
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const {
      name,
      direction,
      action,
      protocol,
      port,
      remoteIp,
      application,
      priority,
      isActive
    } = body;

    const existingRule = await prisma.firewallRule.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: "Firewall rule not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (direction !== undefined) updateData.direction = direction.toUpperCase();
    if (action !== undefined) updateData.action = action.toUpperCase();
    if (protocol !== undefined) updateData.protocol = protocol.toUpperCase();
    if (port !== undefined) updateData.port = port;
    if (remoteIp !== undefined) updateData.remoteIp = remoteIp;
    if (application !== undefined) updateData.application = application;
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;

    const rule = await prisma.firewallRule.update({
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

    // Create a command to sync the rule to the agent
    await prisma.deviceCommand.create({
      data: {
        computerId: rule.computerId,
        command: "SYNC_FIREWALL",
        payload: JSON.stringify({ ruleId: rule.id, action: "UPDATE" }),
        status: "PENDING",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error updating firewall rule:", error);
    return NextResponse.json(
      { error: "Failed to update firewall rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/firewall/[id] - Delete a firewall rule
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const rule = await prisma.firewallRule.findFirst({
      where: {
        id,
        computer: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Firewall rule not found" },
        { status: 404 }
      );
    }

    // Create a command to remove the rule from the agent
    await prisma.deviceCommand.create({
      data: {
        computerId: rule.computerId,
        command: "SYNC_FIREWALL",
        payload: JSON.stringify({ ruleId: id, action: "DELETE" }),
        status: "PENDING",
      },
    });

    await prisma.firewallRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting firewall rule:", error);
    return NextResponse.json(
      { error: "Failed to delete firewall rule" },
      { status: 500 }
    );
  }
}
