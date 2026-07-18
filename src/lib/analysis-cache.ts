// Client-side cache for repo analyses and on-demand task results.
// Keeps results across reloads and avoids repeat AI calls.
import type { AnalysisResult } from "./analyze.functions";
import { scopedKey } from "./workspaces";

const BASE = "sherlock:cache:v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function KEY(): string {
  return scopedKey(BASE);
}

interface Entry {
  analysis: AnalysisResult;
  tasks: Record<string, unknown>;
  savedAt: number;
}

type Store = Record<string, Entry>;

function keyFor(repoUrl: string, model: string): string {
  return `${repoUrl.trim().toLowerCase()}::${model}`;
}

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    // sweep old entries
    const now = Date.now();
    for (const k of Object.keys(parsed)) {
      if (now - parsed[k].savedAt > TTL_MS) delete parsed[k];
    }
    return parsed;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(), JSON.stringify(store));
  } catch {
    /* quota — ignore */
  }
}

export function getCachedAnalysis(repoUrl: string, model: string): AnalysisResult | null {
  const store = read();
  return store[keyFor(repoUrl, model)]?.analysis ?? null;
}

export function saveAnalysis(repoUrl: string, model: string, analysis: AnalysisResult) {
  const store = read();
  const k = keyFor(repoUrl, model);
  store[k] = { analysis, tasks: store[k]?.tasks ?? {}, savedAt: Date.now() };
  write(store);
}

export function getCachedTask<T = unknown>(
  repoUrl: string,
  model: string,
  taskKey: string,
): T | null {
  const store = read();
  return (store[keyFor(repoUrl, model)]?.tasks?.[taskKey] as T) ?? null;
}

export function saveTask(
  repoUrl: string,
  model: string,
  taskKey: string,
  value: unknown,
) {
  const store = read();
  const k = keyFor(repoUrl, model);
  if (!store[k]) return;
  store[k].tasks[taskKey] = value;
  store[k].savedAt = Date.now();
  write(store);
}

export function clearAnalysis(repoUrl: string, model: string) {
  const store = read();
  delete store[keyFor(repoUrl, model)];
  write(store);
}

export function listRecent(): { repoUrl: string; model: string; fullName: string; savedAt: number }[] {
  const store = read();
  return Object.entries(store)
    .map(([k, v]) => {
      const [repoUrl, model] = k.split("::");
      return { repoUrl, model, fullName: v.analysis.meta.fullName, savedAt: v.savedAt };
    })
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, 8);
}