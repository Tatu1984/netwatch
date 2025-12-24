import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const applications = [
  { name: "Visual Studio Code", category: "productive" },
  { name: "Chrome", category: "neutral" },
  { name: "Slack", category: "productive" },
  { name: "Microsoft Teams", category: "productive" },
  { name: "Zoom", category: "productive" },
  { name: "Figma", category: "productive" },
  { name: "Terminal", category: "productive" },
  { name: "Spotify", category: "unproductive" },
  { name: "Discord", category: "unproductive" },
  { name: "Twitter", category: "unproductive" },
  { name: "YouTube", category: "unproductive" },
  { name: "Notion", category: "productive" },
  { name: "Postman", category: "productive" },
  { name: "TablePlus", category: "productive" },
  { name: "Firefox", category: "neutral" },
];

const websites = [
  { name: "github.com", category: "productive" },
  { name: "stackoverflow.com", category: "productive" },
  { name: "docs.google.com", category: "productive" },
  { name: "figma.com", category: "productive" },
  { name: "notion.so", category: "productive" },
  { name: "twitter.com", category: "unproductive" },
  { name: "facebook.com", category: "unproductive" },
  { name: "youtube.com", category: "unproductive" },
  { name: "reddit.com", category: "unproductive" },
  { name: "netflix.com", category: "unproductive" },
  { name: "linkedin.com", category: "neutral" },
  { name: "google.com", category: "neutral" },
  { name: "mail.google.com", category: "productive" },
  { name: "aws.amazon.com", category: "productive" },
  { name: "vercel.com", category: "productive" },
];

function randomDate(start: Date, end: Date) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function randomDuration(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.screenshot.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.blockRule.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.computer.deleteMany();
  await prisma.computerGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "enterprise",
    },
  });

  console.log("Created organization:", org.name);

  // Create users
  const hashedPassword = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@acme.com",
      password: hashedPassword,
      name: "John Admin",
      role: "ADMIN",
      organizationId: org.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@acme.com",
      password: hashedPassword,
      name: "Sarah Manager",
      role: "MANAGER",
      organizationId: org.id,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: "viewer@acme.com",
      password: hashedPassword,
      name: "Mike Viewer",
      role: "VIEWER",
      organizationId: org.id,
    },
  });

  console.log("Created users:", admin.email, manager.email, viewer.email);

  // Create computer groups
  const groups = await Promise.all([
    prisma.computerGroup.create({
      data: {
        name: "Engineering",
        color: "#3B82F6",
        organizationId: org.id,
      },
    }),
    prisma.computerGroup.create({
      data: {
        name: "Sales",
        color: "#10B981",
        organizationId: org.id,
      },
    }),
    prisma.computerGroup.create({
      data: {
        name: "Marketing",
        color: "#F59E0B",
        organizationId: org.id,
      },
    }),
  ]);

  console.log("Created groups:", groups.map((g) => g.name).join(", "));

  // Create computers
  const computerData = [
    { name: "Alice's MacBook", hostname: "alice-mbp", osType: "macos", group: 0 },
    { name: "Bob's Desktop", hostname: "bob-desktop", osType: "windows", group: 0 },
    { name: "Charlie's Laptop", hostname: "charlie-laptop", osType: "windows", group: 0 },
    { name: "Diana's MacBook", hostname: "diana-mbp", osType: "macos", group: 0 },
    { name: "Eve's Workstation", hostname: "eve-ws", osType: "linux", group: 0 },
    { name: "Frank's PC", hostname: "frank-pc", osType: "windows", group: 1 },
    { name: "Grace's Laptop", hostname: "grace-laptop", osType: "windows", group: 1 },
    { name: "Henry's MacBook", hostname: "henry-mbp", osType: "macos", group: 1 },
    { name: "Ivy's Desktop", hostname: "ivy-desktop", osType: "windows", group: 1 },
    { name: "Jack's Laptop", hostname: "jack-laptop", osType: "windows", group: 1 },
    { name: "Kate's MacBook", hostname: "kate-mbp", osType: "macos", group: 2 },
    { name: "Leo's Desktop", hostname: "leo-desktop", osType: "windows", group: 2 },
    { name: "Mia's Laptop", hostname: "mia-laptop", osType: "windows", group: 2 },
    { name: "Nick's MacBook", hostname: "nick-mbp", osType: "macos", group: 2 },
    { name: "Olivia's Desktop", hostname: "olivia-desktop", osType: "windows", group: 2 },
  ];

  const computers = await Promise.all(
    computerData.map((c, index) =>
      prisma.computer.create({
        data: {
          name: c.name,
          hostname: c.hostname,
          ipAddress: `192.168.1.${100 + index}`,
          osType: c.osType,
          status: Math.random() > 0.3 ? "ONLINE" : "OFFLINE",
          lastSeen: new Date(Date.now() - Math.random() * 3600000),
          organizationId: org.id,
          groupId: groups[c.group].id,
        },
      })
    )
  );

  console.log("Created", computers.length, "computers");

  // Create activity logs
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const activityLogs = [];

  for (const computer of computers) {
    // Generate 30-50 activities per computer
    const activityCount = randomDuration(30, 50);

    for (let i = 0; i < activityCount; i++) {
      const isApp = Math.random() > 0.4;
      const source = isApp
        ? applications[Math.floor(Math.random() * applications.length)]
        : websites[Math.floor(Math.random() * websites.length)];

      const startedAt = randomDate(weekAgo, now);
      const duration = randomDuration(60, 7200); // 1 minute to 2 hours
      const endedAt = new Date(startedAt.getTime() + duration * 1000);

      activityLogs.push({
        computerId: computer.id,
        type: isApp ? "APP" : "WEBSITE",
        title: source.name,
        details: isApp ? `Application: ${source.name}` : `https://${source.name}`,
        duration,
        startedAt,
        endedAt,
        category: source.category,
      });
    }
  }

  await prisma.activityLog.createMany({
    data: activityLogs,
  });

  console.log("Created", activityLogs.length, "activity logs");

  // Create screenshots (placeholder URLs)
  const screenshots = [];
  for (const computer of computers) {
    const screenshotCount = randomDuration(3, 5);
    for (let i = 0; i < screenshotCount; i++) {
      screenshots.push({
        computerId: computer.id,
        imageUrl: `https://picsum.photos/seed/${computer.id}-${i}/1920/1080`,
        capturedAt: randomDate(weekAgo, now),
      });
    }
  }

  await prisma.screenshot.createMany({
    data: screenshots,
  });

  console.log("Created", screenshots.length, "screenshots");

  // Create blocking rules
  await prisma.blockRule.createMany({
    data: [
      {
        type: "WEBSITE",
        pattern: "*.facebook.com",
        action: "BLOCK",
        organizationId: org.id,
        isActive: true,
      },
      {
        type: "WEBSITE",
        pattern: "*.twitter.com",
        action: "WARN",
        organizationId: org.id,
        isActive: true,
      },
      {
        type: "WEBSITE",
        pattern: "*.reddit.com",
        action: "LOG",
        organizationId: org.id,
        isActive: true,
      },
      {
        type: "WEBSITE",
        pattern: "*.netflix.com",
        action: "BLOCK",
        organizationId: org.id,
        isActive: true,
      },
      {
        type: "APP",
        pattern: "Steam",
        action: "BLOCK",
        organizationId: org.id,
        isActive: true,
      },
      {
        type: "APP",
        pattern: "Discord",
        action: "WARN",
        organizationId: org.id,
        isActive: false,
      },
    ],
  });

  console.log("Created blocking rules");

  // Create alerts
  const alertTypes = ["POLICY_VIOLATION", "IDLE", "OFFLINE", "SUSPICIOUS"];
  const alertMessages = {
    POLICY_VIOLATION: [
      "Attempted to access blocked website: facebook.com",
      "Tried to launch blocked application: Steam",
      "Visited restricted site: reddit.com",
    ],
    IDLE: [
      "Computer has been idle for over 30 minutes",
      "No activity detected for 1 hour",
    ],
    OFFLINE: [
      "Computer went offline unexpectedly",
      "Lost connection to monitoring agent",
    ],
    SUSPICIOUS: [
      "Unusual activity pattern detected",
      "Multiple failed login attempts",
      "Sensitive file access detected",
    ],
  };

  const alerts = [];
  for (let i = 0; i < 25; i++) {
    const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const messages = alertMessages[type as keyof typeof alertMessages];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const computer = computers[Math.floor(Math.random() * computers.length)];

    alerts.push({
      type,
      message,
      computerId: computer.id,
      organizationId: org.id,
      isRead: Math.random() > 0.6,
      createdAt: randomDate(weekAgo, now),
    });
  }

  await prisma.alert.createMany({
    data: alerts,
  });

  console.log("Created", alerts.length, "alerts");

  // Create settings
  await prisma.setting.createMany({
    data: [
      { key: "screenshot_interval", value: "300", organizationId: org.id },
      { key: "idle_timeout", value: "1800", organizationId: org.id },
      { key: "data_retention_days", value: "90", organizationId: org.id },
      { key: "enable_recordings", value: "true", organizationId: org.id },
      { key: "notify_offline", value: "true", organizationId: org.id },
      { key: "notify_policy_violation", value: "true", organizationId: org.id },
    ],
  });

  console.log("Created settings");

  // Create keylogs
  const keylogApplications = ["Chrome", "Visual Studio Code", "Slack", "Terminal", "Microsoft Word"];
  const sampleKeystrokes = [
    "Hello, this is a test message",
    "const user = await prisma.user.findUnique({ where: { email } });",
    "Meeting at 3pm today to discuss the project",
    "npm install prisma --save-dev",
    "The quick brown fox jumps over the lazy dog",
    "password123 just kidding",
    "git commit -m 'fixed bug in authentication'",
    "SELECT * FROM users WHERE active = true",
    "Dear team, please review the attached document",
    "curl -X POST https://api.example.com/data",
  ];

  const keylogs = [];
  for (const computer of computers.slice(0, 5)) {
    const keylogCount = randomDuration(10, 20);
    for (let i = 0; i < keylogCount; i++) {
      keylogs.push({
        computerId: computer.id,
        windowTitle: `${keylogApplications[Math.floor(Math.random() * keylogApplications.length)]} - Document ${i}`,
        application: keylogApplications[Math.floor(Math.random() * keylogApplications.length)],
        keystrokes: sampleKeystrokes[Math.floor(Math.random() * sampleKeystrokes.length)],
        capturedAt: randomDate(weekAgo, now),
      });
    }
  }

  await prisma.keylog.createMany({
    data: keylogs,
  });

  console.log("Created", keylogs.length, "keylogs");

  // Create device commands
  const commandTypes = ["LOCK", "UNLOCK", "SCREENSHOT", "MESSAGE", "RESTART"];
  const commandStatuses = ["PENDING", "SENT", "EXECUTED", "FAILED"];

  const deviceCommands = [];
  for (let i = 0; i < 30; i++) {
    const computer = computers[Math.floor(Math.random() * computers.length)];
    const status = commandStatuses[Math.floor(Math.random() * commandStatuses.length)];
    deviceCommands.push({
      computerId: computer.id,
      command: commandTypes[Math.floor(Math.random() * commandTypes.length)],
      status,
      payload: JSON.stringify({ message: "Admin action" }),
      sentAt: status !== "PENDING" ? randomDate(weekAgo, now) : null,
      executedAt: status === "EXECUTED" ? randomDate(weekAgo, now) : null,
      response: status === "EXECUTED" ? "Success" : status === "FAILED" ? "Error: Connection timeout" : null,
      createdAt: randomDate(weekAgo, now),
      createdBy: admin.id,
    });
  }

  await prisma.deviceCommand.createMany({
    data: deviceCommands,
  });

  console.log("Created", deviceCommands.length, "device commands");

  // Create firewall rules
  const firewallRules = [];
  const ruleNames = [
    "Block Social Media",
    "Allow HTTPS",
    "Block Gaming Sites",
    "Allow Corporate VPN",
    "Block P2P Traffic",
    "Allow Email Ports",
  ];

  for (const computer of computers.slice(0, 8)) {
    const ruleCount = randomDuration(2, 4);
    for (let i = 0; i < ruleCount; i++) {
      firewallRules.push({
        computerId: computer.id,
        name: ruleNames[i % ruleNames.length],
        direction: ["INBOUND", "OUTBOUND", "BOTH"][Math.floor(Math.random() * 3)],
        action: Math.random() > 0.3 ? "BLOCK" : "ALLOW",
        protocol: ["TCP", "UDP", "ANY"][Math.floor(Math.random() * 3)],
        port: ["80", "443", "8080", "22", "*"][Math.floor(Math.random() * 5)],
        remoteIp: Math.random() > 0.5 ? "*" : "192.168.1.0/24",
        isActive: Math.random() > 0.2,
        priority: (i + 1) * 10,
      });
    }
  }

  await prisma.firewallRule.createMany({
    data: firewallRules,
  });

  console.log("Created", firewallRules.length, "firewall rules");

  // Create remote sessions
  const sessionTypes = ["VIEW", "CONTROL", "SHELL"];
  const sessionStatuses = ["ENDED", "ENDED", "ENDED", "FAILED"]; // Mostly ended sessions

  const remoteSessions = [];
  for (let i = 0; i < 15; i++) {
    const computer = computers[Math.floor(Math.random() * computers.length)];
    const startedAt = randomDate(weekAgo, now);
    const status = sessionStatuses[Math.floor(Math.random() * sessionStatuses.length)];
    remoteSessions.push({
      computerId: computer.id,
      userId: [admin.id, manager.id][Math.floor(Math.random() * 2)],
      sessionType: sessionTypes[Math.floor(Math.random() * sessionTypes.length)],
      status,
      startedAt,
      endedAt: status === "ENDED" ? new Date(startedAt.getTime() + randomDuration(60, 3600) * 1000) : null,
      sessionKey: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    });
  }

  await prisma.remoteSession.createMany({
    data: remoteSessions,
  });

  console.log("Created", remoteSessions.length, "remote sessions");

  // Create clipboard logs
  const clipboardContent = [
    { type: "TEXT", content: "Copied text from document" },
    { type: "TEXT", content: "https://github.com/example/repo" },
    { type: "TEXT", content: "user@example.com" },
    { type: "TEXT", content: "SELECT * FROM users WHERE id = 1" },
    { type: "FILE", content: "C:\\Users\\John\\Documents\\report.pdf" },
    { type: "TEXT", content: "Meeting notes for Q4 planning session" },
    { type: "IMAGE", content: "screenshot_2024_01_15.png" },
  ];

  const clipboardLogs = [];
  for (const computer of computers.slice(0, 6)) {
    const logCount = randomDuration(5, 10);
    for (let i = 0; i < logCount; i++) {
      const clip = clipboardContent[Math.floor(Math.random() * clipboardContent.length)];
      clipboardLogs.push({
        computerId: computer.id,
        contentType: clip.type,
        content: clip.content,
        application: keylogApplications[Math.floor(Math.random() * keylogApplications.length)],
        capturedAt: randomDate(weekAgo, now),
      });
    }
  }

  await prisma.clipboardLog.createMany({
    data: clipboardLogs,
  });

  console.log("Created", clipboardLogs.length, "clipboard logs");

  // Create process logs (snapshot for first 5 computers)
  const processNames = [
    { name: "chrome.exe", path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
    { name: "code.exe", path: "C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\code.exe" },
    { name: "slack.exe", path: "C:\\Users\\User\\AppData\\Local\\slack\\slack.exe" },
    { name: "explorer.exe", path: "C:\\Windows\\explorer.exe" },
    { name: "node.exe", path: "C:\\Program Files\\nodejs\\node.exe" },
    { name: "svchost.exe", path: "C:\\Windows\\System32\\svchost.exe" },
    { name: "System", path: null },
    { name: "dwm.exe", path: "C:\\Windows\\System32\\dwm.exe" },
    { name: "taskhostw.exe", path: "C:\\Windows\\System32\\taskhostw.exe" },
    { name: "SearchIndexer.exe", path: "C:\\Windows\\System32\\SearchIndexer.exe" },
  ];

  const processLogs = [];
  const capturedAt = new Date();
  for (const computer of computers.slice(0, 5)) {
    for (let i = 0; i < processNames.length; i++) {
      const proc = processNames[i];
      processLogs.push({
        computerId: computer.id,
        processName: proc.name,
        processId: 1000 + i * 100 + Math.floor(Math.random() * 100),
        path: proc.path,
        cpuUsage: Math.random() * 30,
        memoryUsage: Math.random() * 20,
        username: "SYSTEM",
        capturedAt,
      });
    }
  }

  await prisma.processLog.createMany({
    data: processLogs,
  });

  console.log("Created", processLogs.length, "process logs");

  // Update computer resource usage
  for (const computer of computers) {
    await prisma.computer.update({
      where: { id: computer.id },
      data: {
        cpuUsage: Math.random() * 60 + 10,
        memoryUsage: Math.random() * 50 + 20,
        diskUsage: Math.random() * 40 + 30,
        agentVersion: "1.0.5",
      },
    });
  }

  console.log("Updated computer resource usage");

  console.log("\n✅ Database seeded successfully!");
  console.log("\nTest credentials:");
  console.log("Admin: admin@acme.com / password123");
  console.log("Manager: manager@acme.com / password123");
  console.log("Viewer: viewer@acme.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
