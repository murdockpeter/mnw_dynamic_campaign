import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "./fs-helpers.mjs";

export async function appendAuditEvent(workspaceRoot, action, details = {}) {
  const auditDir = path.join(workspaceRoot, "generated", "audit");
  const auditPath = path.join(auditDir, "operator-actions.jsonl");
  await ensureDir(auditDir);
  const record = {
    timestamp: new Date().toISOString(),
    action,
    details
  };
  await fs.appendFile(auditPath, `${JSON.stringify(record)}\n`, "utf8");
  return auditPath;
}
