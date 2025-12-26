import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up production database...");

  // Check if organization already exists
  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    console.log("Database already initialized. Skipping setup.");
    console.log("Organization:", existingOrg.name);
    return;
  }

  // Get credentials from environment or generate secure defaults
  const orgName = process.env.ORG_NAME || "My Organization";
  const orgSlug = process.env.ORG_SLUG || orgName.toLowerCase().replace(/\s+/g, "-");
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Administrator";

  if (!adminEmail || !adminPassword) {
    console.error("\n❌ ERROR: Admin credentials not provided!");
    console.error("\nPlease set the following environment variables:");
    console.error("  ADMIN_EMAIL=your-email@company.com");
    console.error("  ADMIN_PASSWORD=your-secure-password");
    console.error("\nOptional:");
    console.error("  ORG_NAME=Your Company Name");
    console.error("  ADMIN_NAME=Your Name");
    console.error("\nExample:");
    console.error('  ADMIN_EMAIL="admin@company.com" ADMIN_PASSWORD="SecurePass123!" npx tsx prisma/seed-production.ts');
    process.exit(1);
  }

  // Validate password strength
  if (adminPassword.length < 8) {
    console.error("\n❌ ERROR: Password must be at least 8 characters long");
    process.exit(1);
  }

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: orgSlug,
      plan: "professional",
    },
  });

  console.log("✅ Created organization:", org.name);

  // Create admin user with secure password
  const hashedPassword = await bcrypt.hash(adminPassword, 12); // Higher rounds for production

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
      role: "ADMIN",
      organizationId: org.id,
    },
  });

  console.log("✅ Created admin user:", admin.email);

  // Create default computer groups
  await Promise.all([
    prisma.computerGroup.create({
      data: {
        name: "Default",
        color: "#6B7280",
        organizationId: org.id,
      },
    }),
  ]);

  console.log("✅ Created default computer group");

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

  console.log("✅ Created default settings");

  console.log("\n========================================");
  console.log("  Production Setup Complete!");
  console.log("========================================");
  console.log("\nYou can now log in with:");
  console.log(`  Email: ${adminEmail}`);
  console.log("  Password: (the one you provided)");
  console.log("\n");
}

main()
  .catch((e) => {
    console.error("Setup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
