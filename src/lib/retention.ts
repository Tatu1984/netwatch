import { prisma } from "@/lib/prisma";

// Default retention periods in days
export const DEFAULT_RETENTION_PERIODS = {
  activityLogs: 90,      // 3 months
  screenshots: 30,       // 1 month
  recordings: 14,        // 2 weeks
  keylogs: 30,           // 1 month
  clipboardLogs: 14,     // 2 weeks
  processLogs: 7,        // 1 week
  websiteLogs: 60,       // 2 months
  auditLogs: 365,        // 1 year
  alerts: 90,            // 3 months
  deviceCommands: 30,    // 1 month
  remoteSessions: 30,    // 1 month
  fileTransfers: 30,     // 1 month
};

export type RetentionPeriods = typeof DEFAULT_RETENTION_PERIODS;

interface CleanupResult {
  model: string;
  deleted: number;
  error?: string;
}

/**
 * Get retention settings for an organization
 */
export async function getRetentionSettings(organizationId: string): Promise<RetentionPeriods> {
  try {
    const setting = await prisma.setting.findFirst({
      where: {
        organizationId,
        key: "dataRetention",
      },
    });

    if (setting?.value) {
      return { ...DEFAULT_RETENTION_PERIODS, ...JSON.parse(setting.value) };
    }

    return DEFAULT_RETENTION_PERIODS;
  } catch {
    return DEFAULT_RETENTION_PERIODS;
  }
}

/**
 * Update retention settings for an organization
 */
export async function updateRetentionSettings(
  organizationId: string,
  settings: Partial<RetentionPeriods>
): Promise<void> {
  const currentSettings = await getRetentionSettings(organizationId);
  const newSettings = { ...currentSettings, ...settings };

  await prisma.setting.upsert({
    where: {
      organizationId_key: {
        organizationId,
        key: "dataRetention",
      },
    },
    update: {
      value: JSON.stringify(newSettings),
    },
    create: {
      organizationId,
      key: "dataRetention",
      value: JSON.stringify(newSettings),
    },
  });
}

/**
 * Calculate date threshold based on retention days
 */
function getThresholdDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Cleanup old data for a specific organization
 */
export async function cleanupOrganizationData(organizationId: string): Promise<CleanupResult[]> {
  const settings = await getRetentionSettings(organizationId);
  const results: CleanupResult[] = [];

  // Get computers for this organization
  const computers = await prisma.computer.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const computerIds = computers.map((c) => c.id);

  if (computerIds.length === 0) {
    return results;
  }

  // Cleanup activity logs
  try {
    const threshold = getThresholdDate(settings.activityLogs);
    const result = await prisma.activityLog.deleteMany({
      where: {
        computerId: { in: computerIds },
        startTime: { lt: threshold },
      },
    });
    results.push({ model: "ActivityLog", deleted: result.count });
  } catch (error) {
    results.push({ model: "ActivityLog", deleted: 0, error: String(error) });
  }

  // Cleanup screenshots
  try {
    const threshold = getThresholdDate(settings.screenshots);
    const result = await prisma.screenshot.deleteMany({
      where: {
        computerId: { in: computerIds },
        capturedAt: { lt: threshold },
      },
    });
    results.push({ model: "Screenshot", deleted: result.count });
  } catch (error) {
    results.push({ model: "Screenshot", deleted: 0, error: String(error) });
  }

  // Cleanup recordings
  try {
    const threshold = getThresholdDate(settings.recordings);
    const result = await prisma.recording.deleteMany({
      where: {
        computerId: { in: computerIds },
        startedAt: { lt: threshold },
      },
    });
    results.push({ model: "Recording", deleted: result.count });
  } catch (error) {
    results.push({ model: "Recording", deleted: 0, error: String(error) });
  }

  // Cleanup keylogs
  try {
    const threshold = getThresholdDate(settings.keylogs);
    const result = await prisma.keylog.deleteMany({
      where: {
        computerId: { in: computerIds },
        capturedAt: { lt: threshold },
      },
    });
    results.push({ model: "Keylog", deleted: result.count });
  } catch (error) {
    results.push({ model: "Keylog", deleted: 0, error: String(error) });
  }

  // Cleanup clipboard logs
  try {
    const threshold = getThresholdDate(settings.clipboardLogs);
    const result = await prisma.clipboardLog.deleteMany({
      where: {
        computerId: { in: computerIds },
        capturedAt: { lt: threshold },
      },
    });
    results.push({ model: "ClipboardLog", deleted: result.count });
  } catch (error) {
    results.push({ model: "ClipboardLog", deleted: 0, error: String(error) });
  }

  // Cleanup process logs
  try {
    const threshold = getThresholdDate(settings.processLogs);
    const result = await prisma.processLog.deleteMany({
      where: {
        computerId: { in: computerIds },
        capturedAt: { lt: threshold },
      },
    });
    results.push({ model: "ProcessLog", deleted: result.count });
  } catch (error) {
    results.push({ model: "ProcessLog", deleted: 0, error: String(error) });
  }

  // Cleanup website logs
  try {
    const threshold = getThresholdDate(settings.websiteLogs);
    const result = await prisma.websiteLog.deleteMany({
      where: {
        computerId: { in: computerIds },
        visitedAt: { lt: threshold },
      },
    });
    results.push({ model: "WebsiteLog", deleted: result.count });
  } catch (error) {
    results.push({ model: "WebsiteLog", deleted: 0, error: String(error) });
  }

  // Cleanup audit logs
  try {
    const threshold = getThresholdDate(settings.auditLogs);
    const result = await prisma.auditLog.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: threshold },
      },
    });
    results.push({ model: "AuditLog", deleted: result.count });
  } catch (error) {
    results.push({ model: "AuditLog", deleted: 0, error: String(error) });
  }

  // Cleanup alerts
  try {
    const threshold = getThresholdDate(settings.alerts);
    const result = await prisma.alert.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: threshold },
      },
    });
    results.push({ model: "Alert", deleted: result.count });
  } catch (error) {
    results.push({ model: "Alert", deleted: 0, error: String(error) });
  }

  // Cleanup device commands
  try {
    const threshold = getThresholdDate(settings.deviceCommands);
    const result = await prisma.deviceCommand.deleteMany({
      where: {
        computerId: { in: computerIds },
        createdAt: { lt: threshold },
      },
    });
    results.push({ model: "DeviceCommand", deleted: result.count });
  } catch (error) {
    results.push({ model: "DeviceCommand", deleted: 0, error: String(error) });
  }

  // Cleanup remote sessions
  try {
    const threshold = getThresholdDate(settings.remoteSessions);
    const result = await prisma.remoteSession.deleteMany({
      where: {
        computerId: { in: computerIds },
        startedAt: { lt: threshold },
      },
    });
    results.push({ model: "RemoteSession", deleted: result.count });
  } catch (error) {
    results.push({ model: "RemoteSession", deleted: 0, error: String(error) });
  }

  // Cleanup file transfers
  try {
    const threshold = getThresholdDate(settings.fileTransfers);
    const result = await prisma.fileTransfer.deleteMany({
      where: {
        computerId: { in: computerIds },
        startedAt: { lt: threshold },
      },
    });
    results.push({ model: "FileTransfer", deleted: result.count });
  } catch (error) {
    results.push({ model: "FileTransfer", deleted: 0, error: String(error) });
  }

  return results;
}

/**
 * Run cleanup for all organizations
 */
export async function runGlobalCleanup(): Promise<Map<string, CleanupResult[]>> {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  const results = new Map<string, CleanupResult[]>();

  for (const org of organizations) {
    const orgResults = await cleanupOrganizationData(org.id);
    results.set(org.name, orgResults);
  }

  return results;
}

/**
 * Get storage statistics for an organization
 */
export async function getStorageStats(organizationId: string) {
  const computers = await prisma.computer.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const computerIds = computers.map((c) => c.id);

  const [
    activityLogs,
    screenshots,
    recordings,
    keylogs,
    clipboardLogs,
    processLogs,
    websiteLogs,
    auditLogs,
    alerts,
  ] = await Promise.all([
    prisma.activityLog.count({ where: { computerId: { in: computerIds } } }),
    prisma.screenshot.count({ where: { computerId: { in: computerIds } } }),
    prisma.recording.count({ where: { computerId: { in: computerIds } } }),
    prisma.keylog.count({ where: { computerId: { in: computerIds } } }),
    prisma.clipboardLog.count({ where: { computerId: { in: computerIds } } }),
    prisma.processLog.count({ where: { computerId: { in: computerIds } } }),
    prisma.websiteLog.count({ where: { computerId: { in: computerIds } } }),
    prisma.auditLog.count({ where: { organizationId } }),
    prisma.alert.count({ where: { organizationId } }),
  ]);

  // Get size estimates (actual file sizes for screenshots and recordings)
  const screenshotSize = await prisma.screenshot.aggregate({
    where: { computerId: { in: computerIds } },
    _sum: { fileSize: true },
  });

  const recordingSize = await prisma.recording.aggregate({
    where: { computerId: { in: computerIds } },
    _sum: { fileSize: true },
  });

  return {
    counts: {
      activityLogs,
      screenshots,
      recordings,
      keylogs,
      clipboardLogs,
      processLogs,
      websiteLogs,
      auditLogs,
      alerts,
    },
    sizes: {
      screenshots: screenshotSize._sum.fileSize || 0,
      recordings: recordingSize._sum.fileSize || 0,
    },
    totalRecords:
      activityLogs +
      screenshots +
      recordings +
      keylogs +
      clipboardLogs +
      processLogs +
      websiteLogs +
      auditLogs +
      alerts,
  };
}
