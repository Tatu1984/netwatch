import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/settings - Get organization settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.setting.findMany({
      where: { organizationId: session.user.organizationId },
    });

    // Convert to key-value object
    const settingsObj: Record<string, string> = {};
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value;
    });

    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update organization settings
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { settings } = body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { error: "Settings object is required" },
        { status: 400 }
      );
    }

    // Upsert each setting
    const updates = Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({
        where: {
          organizationId_key: {
            organizationId: session.user.organizationId,
            key,
          },
        },
        update: { value: String(value) },
        create: {
          organizationId: session.user.organizationId,
          key,
          value: String(value),
        },
      })
    );

    await Promise.all(updates);

    // Return updated settings
    const updatedSettings = await prisma.setting.findMany({
      where: { organizationId: session.user.organizationId },
    });

    const settingsObj: Record<string, string> = {};
    updatedSettings.forEach((setting) => {
      settingsObj[setting.key] = setting.value;
    });

    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
