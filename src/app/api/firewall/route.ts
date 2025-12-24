import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/firewall - List firewall rules
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const computerId = searchParams.get("computerId");
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {
      computer: {
        organizationId: session.user.organizationId,
      },
    };

    if (computerId) {
      where.computerId = computerId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const rules = await prisma.firewallRule.findMany({
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
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching firewall rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch firewall rules" },
      { status: 500 }
    );
  }
}

// POST /api/firewall - Create firewall rule
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
    const {
      computerId,
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

    if (!computerId || !name || !direction || !action || !protocol) {
      return NextResponse.json(
        { error: "computerId, name, direction, action, and protocol are required" },
        { status: 400 }
      );
    }

    // Validate direction
    const validDirections = ["INBOUND", "OUTBOUND", "BOTH"];
    if (!validDirections.includes(direction.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid direction. Must be INBOUND, OUTBOUND, or BOTH" },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ["ALLOW", "BLOCK"];
    if (!validActions.includes(action.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid action. Must be ALLOW or BLOCK" },
        { status: 400 }
      );
    }

    // Validate protocol
    const validProtocols = ["TCP", "UDP", "ICMP", "ANY"];
    if (!validProtocols.includes(protocol.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid protocol. Must be TCP, UDP, ICMP, or ANY" },
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

    const rule = await prisma.firewallRule.create({
      data: {
        computerId,
        name,
        direction: direction.toUpperCase(),
        action: action.toUpperCase(),
        protocol: protocol.toUpperCase(),
        port: port || null,
        remoteIp: remoteIp || null,
        application: application || null,
        priority: priority || 100,
        isActive: isActive !== false,
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

    // Create a command to sync the rule to the agent
    await prisma.deviceCommand.create({
      data: {
        computerId,
        command: "SYNC_FIREWALL",
        payload: JSON.stringify({ ruleId: rule.id, action: "ADD" }),
        status: "PENDING",
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating firewall rule:", error);
    return NextResponse.json(
      { error: "Failed to create firewall rule" },
      { status: 500 }
    );
  }
}
