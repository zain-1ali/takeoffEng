import { AuditLog } from "../models/index.js";

export async function writeAudit(entry: {
  orgId?: string | null;
  actorId?: string | null;
  action: string;
  target?: string | null;
  ip?: string | null;
  data?: unknown;
}): Promise<void> {
  await AuditLog.create({
    orgId: entry.orgId ?? null,
    actorId: entry.actorId ?? null,
    action: entry.action,
    target: entry.target ?? null,
    ip: entry.ip ?? null,
    data: entry.data ?? null,
  });
}
