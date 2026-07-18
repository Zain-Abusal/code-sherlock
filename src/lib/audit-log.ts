// Audit trail — every AI call, cache hit, health check, private-repo access.
// Enterprise-grade export as JSON or CSV for compliance / cost tracking.

import { scopedKey } from "./workspaces";

export type AuditKind =
  | "analyze"
  | "task"
  | "chat"
  | "cache_hit"
  | "cache_miss"
  | "health_check"
  | "pdf_export"
  | "audit_export"
  | "error";

export interface AuditEntry {
  id: string;
  ts: number;
  kind: AuditKind;
  actor: string; // workspace name
  repo?: string;
  provider?: string;
  model?: string;
  detail?: string;
  latencyMs?: number;
  ok: boolean;
}

const BASE = "sherlock:audit:v1";
const MAX_ENTRIES = 500;

function key(): string {
  return scopedKey(BASE);
}

function read(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key());
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(), JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

export function logAudit(entry: Omit<AuditEntry, "id" | "ts" | "actor"> & { actor?: string }) {
  const list = read();
  const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  // dynamic import to avoid SSR cost
  let actor = entry.actor;
  if (!actor && typeof window !== "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getActiveWorkspace } = require("./workspaces") as typeof import("./workspaces");
      actor = getActiveWorkspace().name;
    } catch {
      actor = "Personal";
    }
  }
  list.push({
    id,
    ts: Date.now(),
    actor: actor ?? "Personal",
    ...entry,
  });
  write(list);
}

export function listAudit(): AuditEntry[] {
  return read().slice().reverse();
}

export function clearAudit() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key());
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportAuditCSV(): string {
  const rows = read();
  const cols: (keyof AuditEntry)[] = [
    "ts",
    "actor",
    "kind",
    "ok",
    "repo",
    "provider",
    "model",
    "latencyMs",
    "detail",
    "id",
  ];
  const header = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => (c === "ts" ? new Date(r[c]).toISOString() : csvEscape(r[c])))
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function exportAuditJSON(): string {
  return JSON.stringify(read(), null, 2);
}

export function downloadAudit(format: "csv" | "json") {
  if (typeof window === "undefined") return;
  const content = format === "csv" ? exportAuditCSV() : exportAuditJSON();
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `codesherlock-audit-${stamp}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  logAudit({ kind: "audit_export", ok: true, detail: `exported ${format.toUpperCase()}` });
}