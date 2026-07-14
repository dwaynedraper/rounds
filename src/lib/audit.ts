import { db } from "@/db";
import { auditLog } from "@/db/schema";

/* S5 — audit trail. Called by every CMS mutation (actor = email) and every
 * public write (actor = device_hash). Never records an IP or any PII (S10). */

export type AuditEntry = {
  actor: string; // email (CMS) or device_hash (public)
  entity: string; // 'product' | 'position' | 'condition' | 'round' | ...
  entityId: string;
  action: "create" | "update" | "delete" | "revert" | "import";
  before?: unknown;
  after?: unknown;
};

export async function audit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before === undefined ? null : (entry.before as object),
    after: entry.after === undefined ? null : (entry.after as object),
  });
}
