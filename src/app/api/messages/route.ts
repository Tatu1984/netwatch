import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent MESSAGE commands as messages
    const messages = await prisma.deviceCommand.findMany({
      where: {
        command: "MESSAGE",
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
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      title: msg.payload ? JSON.parse(msg.payload).title : "Message",
      content: msg.payload ? JSON.parse(msg.payload).message : "",
      type: msg.payload ? JSON.parse(msg.payload).type : "info",
      lockScreen: msg.payload ? JSON.parse(msg.payload).lockScreen : false,
      targetType: "computer",
      targetIds: [msg.computerId],
      sentAt: msg.createdAt.toISOString(),
      status: msg.status,
      computerName: msg.computer.name,
    }));

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
