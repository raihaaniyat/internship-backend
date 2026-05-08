import { db, tables } from "@internship/db";

/**
 * Lightweight audit-log helper. Call this AFTER a successful DB mutation;
 * never block business success on audit log failures.
 *
 * Examples:
 *   logAction({ userId, action: "save_part", resourceType: "part", resourceId: partId })
 *   logAction({ userId: admin.id, action: "create_part", resourceType: "part", resourceId: id, metadata: { name } })
 */

export interface AuditEntry {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAction(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(tables.auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata,
    });
  } catch (err) {
    // Audit failures should never crash the user's request. Surface to logs only.
    console.error("[audit] failed to write entry:", err, entry);
  }
}
