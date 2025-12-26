import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET - Check if setup is needed
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();

    return NextResponse.json({
      needsSetup: userCount === 0 || orgCount === 0,
      hasOrganization: orgCount > 0,
      hasUsers: userCount > 0,
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json({ needsSetup: true, error: true });
  }
}

// POST - Complete first-time setup
export async function POST(req: NextRequest) {
  try {
    // Check if setup is already complete
    const existingOrg = await prisma.organization.findFirst();
    if (existingOrg) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { organizationName, adminEmail, adminPassword, adminName } = body;

    // Validation
    if (!organizationName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "Organization name, admin email, and password are required" },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Create organization
    const orgSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const org = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: orgSlug,
        plan: "professional",
      },
    });

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        name: adminName || "Administrator",
        role: "ADMIN",
        organizationId: org.id,
      },
    });

    // Create default settings
    await prisma.setting.createMany({
      data: [
        { key: "screenshotInterval", value: "300", organizationId: org.id },
        { key: "activityLogInterval", value: "60", organizationId: org.id },
        { key: "dataRetentionDays", value: "90", organizationId: org.id },
        { key: "alertsEnabled", value: "true", organizationId: org.id },
        { key: "keystrokeLogging", value: "true", organizationId: org.id },
      ],
    });

    // Create default computer group
    await prisma.computerGroup.create({
      data: {
        name: "Default",
        color: "#6B7280",
        organizationId: org.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Setup completed successfully",
      organization: org.name,
      adminEmail: admin.email,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Setup failed. Please try again." },
      { status: 500 }
    );
  }
}
