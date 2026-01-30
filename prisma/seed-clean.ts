import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Clean seeding (no dummy machines)...");

  await prisma.processLog.deleteMany();
  await prisma.clipboardLog.deleteMany();
  await prisma.keylog.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.screenshot.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.firewallRule.deleteMany();
  await prisma.remoteSession.deleteMany();
  await prisma.deviceCommand.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.blockRule.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.computer.deleteMany();
  await prisma.computerGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: "Acme Corp", slug: "acme-corp", plan: "enterprise" },
  });

  const hashedPassword = await bcrypt.hash("password123", 10);

  await prisma.user.createMany({
    data: [
      { email: "admin@acme.com", password: hashedPassword, name: "John Admin", role: "ADMIN", organizationId: org.id },
      { email: "manager@acme.com", password: hashedPassword, name: "Sarah Manager", role: "MANAGER", organizationId: org.id },
      { email: "viewer@acme.com", password: hashedPassword, name: "Mike Viewer", role: "VIEWER", organizationId: org.id },
    ],
  });

  await Promise.all([
    prisma.computerGroup.create({ data: { name: "Engineering", color: "#3B82F6", organizationId: org.id } }),
    prisma.computerGroup.create({ data: { name: "Sales", color: "#10B981", organizationId: org.id } }),
    prisma.computerGroup.create({ data: { name: "Marketing", color: "#F59E0B", organizationId: org.id } }),
  ]);

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

  console.log("\nDone. No dummy machines seeded.");
  console.log("Credentials:");
  console.log("  admin@acme.com / password123");
  console.log("  manager@acme.com / password123");
  console.log("  viewer@acme.com / password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
