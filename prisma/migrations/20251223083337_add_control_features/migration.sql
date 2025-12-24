-- CreateTable
CREATE TABLE "Keylog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "windowTitle" TEXT,
    "application" TEXT,
    "keystrokes" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Keylog_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "executedAt" DATETIME,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "DeviceCommand_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirewallRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "port" TEXT,
    "remoteIp" TEXT,
    "application" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirewallRule_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemoteSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "sessionKey" TEXT,
    CONSTRAINT "RemoteSession_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "remotePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "initiatedBy" TEXT,
    CONSTRAINT "FileTransfer_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClipboardLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "application" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClipboardLog_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computerId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "processId" INTEGER NOT NULL,
    "path" TEXT,
    "cpuUsage" REAL,
    "memoryUsage" REAL,
    "username" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessLog_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Computer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "osType" TEXT NOT NULL DEFAULT 'windows',
    "osVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME,
    "cpuUsage" REAL,
    "memoryUsage" REAL,
    "diskUsage" REAL,
    "agentVersion" TEXT,
    "organizationId" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Computer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Computer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ComputerGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Computer" ("createdAt", "groupId", "hostname", "id", "ipAddress", "lastSeen", "name", "organizationId", "osType", "status", "updatedAt") SELECT "createdAt", "groupId", "hostname", "id", "ipAddress", "lastSeen", "name", "organizationId", "osType", "status", "updatedAt" FROM "Computer";
DROP TABLE "Computer";
ALTER TABLE "new_Computer" RENAME TO "Computer";
CREATE INDEX "Computer_organizationId_idx" ON "Computer"("organizationId");
CREATE INDEX "Computer_groupId_idx" ON "Computer"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Keylog_computerId_idx" ON "Keylog"("computerId");

-- CreateIndex
CREATE INDEX "Keylog_capturedAt_idx" ON "Keylog"("capturedAt");

-- CreateIndex
CREATE INDEX "DeviceCommand_computerId_idx" ON "DeviceCommand"("computerId");

-- CreateIndex
CREATE INDEX "DeviceCommand_status_idx" ON "DeviceCommand"("status");

-- CreateIndex
CREATE INDEX "DeviceCommand_createdAt_idx" ON "DeviceCommand"("createdAt");

-- CreateIndex
CREATE INDEX "FirewallRule_computerId_idx" ON "FirewallRule"("computerId");

-- CreateIndex
CREATE INDEX "RemoteSession_computerId_idx" ON "RemoteSession"("computerId");

-- CreateIndex
CREATE INDEX "RemoteSession_userId_idx" ON "RemoteSession"("userId");

-- CreateIndex
CREATE INDEX "RemoteSession_status_idx" ON "RemoteSession"("status");

-- CreateIndex
CREATE INDEX "FileTransfer_computerId_idx" ON "FileTransfer"("computerId");

-- CreateIndex
CREATE INDEX "FileTransfer_status_idx" ON "FileTransfer"("status");

-- CreateIndex
CREATE INDEX "ClipboardLog_computerId_idx" ON "ClipboardLog"("computerId");

-- CreateIndex
CREATE INDEX "ClipboardLog_capturedAt_idx" ON "ClipboardLog"("capturedAt");

-- CreateIndex
CREATE INDEX "ProcessLog_computerId_idx" ON "ProcessLog"("computerId");

-- CreateIndex
CREATE INDEX "ProcessLog_capturedAt_idx" ON "ProcessLog"("capturedAt");
