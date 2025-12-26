/**
 * Error Tracking Utility
 *
 * For production, integrate with Sentry:
 * 1. npm install @sentry/nextjs
 * 2. Run: npx @sentry/wizard@latest -i nextjs
 * 3. Configure your DSN in .env
 *
 * This module provides a simple abstraction that can be replaced
 * with Sentry or any other error tracking service.
 */

interface ErrorContext {
  userId?: string;
  organizationId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

class ErrorTracker {
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Capture and log an error
   */
  captureError(error: Error, context?: ErrorContext): void {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Always log to console
    console.error("[Error Tracked]", errorData);

    // In production, send to external service
    if (this.isProduction) {
      this.sendToService(errorData);
    }
  }

  /**
   * Capture a message/warning
   */
  captureMessage(message: string, level: "info" | "warning" | "error" = "info", context?: ErrorContext): void {
    const data = {
      message,
      level,
      timestamp: new Date().toISOString(),
      ...context,
    };

    console.log(`[${level.toUpperCase()}]`, data);

    if (this.isProduction && level === "error") {
      this.sendToService(data);
    }
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id: string; email?: string; organizationId?: string }): void {
    // This would set the user in Sentry
    if (this.isProduction) {
      console.log("[ErrorTracker] User context set:", user.id);
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUser(): void {
    if (this.isProduction) {
      console.log("[ErrorTracker] User context cleared");
    }
  }

  /**
   * Send error to external service
   * Replace with actual Sentry integration
   */
  private async sendToService(data: Record<string, unknown>): Promise<void> {
    // TODO: Integrate with Sentry
    // Example:
    // import * as Sentry from "@sentry/nextjs";
    // Sentry.captureException(error);

    // For now, we just log
    console.log("[ErrorTracker] Would send to service:", JSON.stringify(data, null, 2));
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Helper function for API routes
export function withErrorTracking<T>(
  handler: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  return handler().catch((error) => {
    errorTracker.captureError(error as Error, context);
    throw error;
  });
}
