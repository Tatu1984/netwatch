import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readFile } from "fs/promises";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/screenshots/[id]/image - Serve screenshot image bytes
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
        computer: { organizationId: session.user.organizationId },
      },
    });

    if (!screenshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Prefer file on disk
    if (screenshot.filePath) {
      try {
        const buf = await readFile(screenshot.filePath);
        return new NextResponse(buf, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        // File missing — fall through to base64 fallback
      }
    }

    // Fallback: legacy base64 in imageUrl
    if (screenshot.imageUrl) {
      const raw = screenshot.imageUrl.replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(raw, "base64");
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return NextResponse.json({ error: "No image data" }, { status: 404 });
  } catch (error) {
    console.error("Error serving screenshot image:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
