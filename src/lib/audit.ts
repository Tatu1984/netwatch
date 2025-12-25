import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Audit action types
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "COMMAND"
  | "BLOCK"
  | "UNBLOCK"
  | "START_SESSION"
  | "END_SESSION"
  | "DOWNLOAD";

// Audit resource types
export type AuditResource =
  | "User"
  | "Computer"
  | "ComputerGroup"
  | "Policy"
  | "BlockRule"
  | "Alert"
  | "Keylog"
  | "Screenshot"
  | "Recording"
  | "FirewallRule"
  | "RemoteSession"
  | "FileTransfer"
  | "DeviceCommand"
  | "Setting"
  | "Report";

interface AuditLogEntry {
  organizationId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: "SUCCESS" | "FAILURE";
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        userEmail: entry.userEmail,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        status: entry.status || "SUCCESS",
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Create audit log from Next.js request
 */
export async function auditFromRequest(
  request: NextRequest,
  action: AuditAction,
  resource: AuditResource,
  resourceId?: string,
  details?: Record<string, unknown>,
  status: "SUCCESS" | "FAILURE" = "SUCCESS"
): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user) return;

    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    await createAuditLog({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email || undefined,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      status,
    });
  } catch (error) {
    console.error("Failed to create audit log from request:", error);
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0] || realIp || undefined;
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
  organizationId: string;
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {
    organizationId: filters.organizationId,
  };

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.resource) {
    where.resource = filters.resource;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, unknown>).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.createdAt as Record<string, unknown>).lte = filters.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
    total,
  };
}

/**
 * Higher-order function to wrap API route with audit logging
 */
export function withAudit(
  action: AuditAction,
  resource: AuditResource,
  getResourceId?: (request: NextRequest, response?: Response) => string | undefined,
  getDetails?: (request: NextRequest, response?: Response) => Record<string, unknown> | undefined
) {
  return function <T extends (request: NextRequest, ...args: unknown[]) => Promise<Response>>(
    handler: T
  ): T {
    return (async (request: NextRequest, ...args: unknown[]): Promise<Response> => {
      let status: "SUCCESS" | "FAILURE" = "SUCCESS";
      let response: Response;

      try {
        response = await handler(request, ...args);
        status = response.ok ? "SUCCESS" : "FAILURE";
      } catch (error) {
        status = "FAILURE";
        throw error;
      } finally {
        const resourceId = getResourceId?.(request, response!);
        const details = getDetails?.(request, response!);
        await auditFromRequest(request, action, resource, resourceId, details, status);
      }

      return response;
    }) as T;
  };
}

/**
 * Audit log helper for common operations
 */
export const audit = {
  async userLogin(
    organizationId: string,
    userId: string,
    userEmail: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "LOGIN",
      resource: "User",
      resourceId: userId,
      ipAddress,
      userAgent,
      status: success ? "SUCCESS" : "FAILURE",
    });
  },

  async userLogout(
    organizationId: string,
    userId: string,
    userEmail: string,
    ipAddress?: string
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "LOGOUT",
      resource: "User",
      resourceId: userId,
      ipAddress,
    });
  },

  async commandSent(
    organizationId: string,
    userId: string,
    userEmail: string,
    computerId: string,
    command: string,
    payload?: Record<string, unknown>
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "COMMAND",
      resource: "DeviceCommand",
      resourceId: computerId,
      details: { command, payload },
    });
  },

  async dataExported(
    organizationId: string,
    userId: string,
    userEmail: string,
    resource: AuditResource,
    format: string,
    recordCount: number
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "EXPORT",
      resource,
      details: { format, recordCount },
    });
  },

  async sensitiveDataViewed(
    organizationId: string,
    userId: string,
    userEmail: string,
    resource: AuditResource,
    resourceId: string,
    details?: Record<string, unknown>
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "VIEW",
      resource,
      resourceId,
      details,
    });
  },

  async remoteSessionStarted(
    organizationId: string,
    userId: string,
    userEmail: string,
    computerId: string,
    sessionType: string
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "START_SESSION",
      resource: "RemoteSession",
      resourceId: computerId,
      details: { sessionType },
    });
  },

  async remoteSessionEnded(
    organizationId: string,
    userId: string,
    userEmail: string,
    sessionId: string,
    duration?: number
  ) {
    await createAuditLog({
      organizationId,
      userId,
      userEmail,
      action: "END_SESSION",
      resource: "RemoteSession",
      resourceId: sessionId,
      details: { duration },
    });
  },
};
