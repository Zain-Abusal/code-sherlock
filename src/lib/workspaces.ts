// Enterprise workspaces — client-side namespaces that isolate caches,
// audit trails, and provider settings between teams / clients / environments.

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

const WS_KEY = "sherlock:workspaces:v1";
const ACTIVE_KEY = "sherlock:workspace:active";

const DEFAULT_WORKSPACE: Workspace = {
  id: "personal",
  name: "Personal",
  createdAt: 0,
};

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota */
  }
}

export function listWorkspaces(): Workspace[] {
  const list = safeRead<Workspace[]>(WS_KEY, []);
  const merged = [DEFAULT_WORKSPACE, ...list.filter((w) => w.id !== "personal")];
  return merged;
}

export function getActiveWorkspace(): Workspace {
  const id = safeRead<string | null>(ACTIVE_KEY, null);
  const list = listWorkspaces();
  return list.find((w) => w.id === id) ?? DEFAULT_WORKSPACE;
}

export function setActiveWorkspace(id: string) {
  safeWrite(ACTIVE_KEY, id);
}

export function createWorkspace(name: string): Workspace {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("Workspace name required");
  const id = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const ws: Workspace = { id, name: clean, createdAt: Date.now() };
  const list = safeRead<Workspace[]>(WS_KEY, []);
  list.push(ws);
  safeWrite(WS_KEY, list);
  return ws;
}

export function deleteWorkspace(id: string) {
  if (id === "personal") return;
  const list = safeRead<Workspace[]>(WS_KEY, []).filter((w) => w.id !== id);
  safeWrite(WS_KEY, list);
  if (getActiveWorkspace().id === id) setActiveWorkspace("personal");
}

/** Prefix any storage key with the active workspace ID for isolation. */
export function scopedKey(base: string): string {
  const ws = getActiveWorkspace();
  return `${base}::ws:${ws.id}`;
}