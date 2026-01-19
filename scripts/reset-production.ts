/**
 * Production Database Reset Script
 *
 * This script will:
 * 1. Delete ALL data from the database
 * 2. Keep the schema intact
 * 3. Allow fresh setup via the setup wizard
 *
 * Usage: DATABASE_URL="your-neon-url" npx tsx scripts/reset-production.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🚨 PRODUCTION DATABASE RESET');
  console.log('============================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('📍 Database URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
  console.log('\n⏳ Starting reset in 3 seconds... (Ctrl+C to cancel)\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    console.log('🗑️  Deleting all data...\n');

    // Delete in order to respect foreign key constraints
    const tables = [
      'FileTransfer',
      'RemoteSession',
      'DeviceCommand',
      'Keylog',
      'ClipboardLog',
      'ProcessLog',
      'WebsiteLog',
      'Screenshot',
      'Recording',
      'ActivityLog',
      'FirewallRule',
      'Alert',
      'AlertRule',
      'ScheduledReport',
      'AuditLog',
      'BlockRule',
      'Computer',
      'ComputerGroup',
      'Setting',
      'Account',
      'Session',
      'VerificationToken',
      'User',
      'Organization',
    ];

    for (const table of tables) {
      try {
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        console.log(`   ✓ ${table}: ${result} rows deleted`);
      } catch (e: any) {
        if (e.code === 'P2010' || e.message?.includes('does not exist')) {
          console.log(`   - ${table}: table doesn't exist (skipped)`);
        } else {
          console.log(`   ⚠ ${table}: ${e.message}`);
        }
      }
    }

    console.log('\n✅ Database reset complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Go to your dashboard: https://netwatch-nu.vercel.app');
    console.log('   2. Complete the setup wizard to create your organization');
    console.log('   3. Reinstall/reconfigure agents with the socket URL:');
    console.log('      https://do.roydevelops.tech/nw-socket');
    console.log('');

  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
