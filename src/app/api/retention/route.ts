import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getRetentionSettings,
  updateRetentionSettings,
  cleanupOrganizationData,
  getStorageStats,
  RetentionPeriods,
} from "@/lib/retention";
import { audit } from "@/lib/audit";

// GET /api/retention - Get retention settings and stats
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [settings, stats] = await Promise.all([
      getRetentionSettings(session.user.organizationId),
      getStorageStats(session.user.organizationId),
    ]);

    return NextResponse.json({
      settings,
      stats,
    });
  } catch (error) {
    console.error("Error fetching retention data:", error);
    return NextResponse.json(
      { error: "Failed to fetch retention data" },
      { status: 500 }
    );
  }
}

// PUT /api/retention - Update retention settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const settings = body.settings as Partial<RetentionPeriods>;

    // Validate settings (minimum 1 day, maximum 5 years)
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== "number" || value < 1 || value > 1825) {
        return NextResponse.json(
          { error: `Invalid retention period for ${key}. Must be between 1 and 1825 days.` },
          { status: 400 }
        );
      }
    }

    await updateRetentionSettings(session.user.organizationId, settings);

    // Audit the change
    await audit.sensitiveDataViewed(
      session.user.organizationId,
      session.user.id,
      session.user.email || "",
      "Setting",
      "dataRetention",
      { action: "UPDATE", settings }
    );

    const updatedSettings = await getRetentionSettings(session.user.organizationId);

    return NextResponse.json({ settings: updatedSettings });
  } catch (error) {
    console.error("Error updating retention settings:", error);
    return NextResponse.json(
      { error: "Failed to update retention settings" },
      { status: 500 }
    );
  }
}

// POST /api/retention - Run cleanup manually
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = await cleanupOrganizationData(session.user.organizationId);

    // Audit the cleanup
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    await audit.sensitiveDataViewed(
      session.user.organizationId,
      session.user.id,
      session.user.email || "",
      "Setting",
      "dataRetention",
      { action: "CLEANUP", totalDeleted, results }
    );

    return NextResponse.json({
      message: "Cleanup completed",
      results,
      totalDeleted,
    });
  } catch (error) {
    console.error("Error running cleanup:", error);
    return NextResponse.json(
      { error: "Failed to run cleanup" },
      { status: 500 }
    );
  }
}
