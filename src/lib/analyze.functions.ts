import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  fetchFileText,
  fetchLanguages,
  fetchRepoMeta,
  fetchTree,
  parseRepoUrl,
} from "./github.server";
import { callLLM, extractJson } from "./llm.server";
import type { ProviderId } from "./providers";

const ProviderEnum = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "openrouter",
  "ollama",
]);

const AnalyzeInput = z.object({
  repoUrl: z.string().min(3),
  provider: ProviderEnum,
  apiKey: z.string().default(""),
  model: z.string().min(1),
  baseUrl: z.string().optional(),
  githubToken: z.string().optional(),
});

export type AnalyzeInputT = z.infer<typeof AnalyzeInput>;

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: "frontend" | "api" | "database" | "external" | "worker" | "shared";
  explanation: string;
  files?: string[];
}

export interface FolderInsight {
  path: string;
  summary: string;
  role: string;
  confidence: number;
}

export interface AnalysisResult {
  meta: {
    fullName: string;
    description: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    language: string | null;
    license: string | null;
    pushedAt: string;
    url: string;
    ownerAvatar: string;
    defaultBranch: string;
    isPrivate?: boolean;
  };
  stats: {
    fileCount: number;
    truncated: boolean;
    languages: Record<string, number>;
  };
  keyFiles: string[];
  overview: string;
  audience: string;
  complexity: "low" | "medium" | "high";
  learningCurve: "gentle" | "moderate" | "steep";
  technologies: string[];
  healthScore: number;
  healthBreakdown: { label: string; verdict: "good" | "warn" | "risk"; note: string }[];
  architecture: ArchitectureNode[];
  folders: FolderInsight[];
  entryPoints: string[];
  risks: { title: string; severity: "critical" | "warning" | "suggestion"; note: string }[];
  suggestedQuestions: string[];
  timeline: string[];
  perf?: {
    latencyMs: number;
    servedFromCache: boolean;
    generatedAt: string;
  };
}

const KEY_FILE_CANDIDATES = [
  "README.md",
  "readme.md",
  "Readme.md",
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "composer.json",
  "Gemfile",
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "tsconfig.json",
  "docker-compose.yml",
  "Dockerfile",
  ".env.example",
];

function shortenTree(paths: string[], limit = 350): string {
  const sorted = [...paths].sort();
  if (sorted.length <= limit) return sorted.join("\n");
  const head = sorted.slice(0, limit);
  return head.join("\n") + `\n… (+${sorted.length - limit} more)`;
}

function topDirs(paths: string[], depth = 2): string[] {
  const seen = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    for (let d = 1; d <= depth && d <= parts.length - 1; d++) {
      seen.add(parts.slice(0, d).join("/"));
    }
  }
  return [...seen].sort();
}

const ANALYSIS_SYSTEM = `You are CodeSherlock, a senior staff engineer who analyzes GitHub repositories with speed and precision. You produce concise, factual, useful summaries — never fluff. You always return valid JSON matching the requested schema. Ground every claim in the provided files. If unsure, say so and lower the confidence.`;

function buildAnalysisPrompt(ctx: {
  meta: { fullName: string; description: string | null; language: string | null };
  languages: Record<string, number>;
  tree: string;
  dirs: string[];
  files: Record<string, string>;
}): string {
  const langs = Object.entries(ctx.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");
  const filesBlock = Object.entries(ctx.files)
    .map(([p, c]) => `--- FILE: ${p}\n${c.slice(0, 4000)}`)
    .join("\n\n");
  return `Repository: ${ctx.meta.fullName}
Description: ${ctx.meta.description ?? "(none)"}
Primary language: ${ctx.meta.language ?? "unknown"}
Language bytes: ${langs}

Top-level directories:
${ctx.dirs.join("\n")}

File tree (up to 350 paths):
${ctx.tree}

Selected file contents (truncated):
${filesBlock}

Return a single JSON object with EXACTLY these fields:
{
  "overview": "1 paragraph, 4–6 sentences, plain English",
  "audience": "who this project is for, 1 sentence",
  "complexity": "low|medium|high",
  "learningCurve": "gentle|moderate|steep",
  "technologies": ["array of key technologies/frameworks, max 12"],
  "healthScore": 0-100 integer,
  "healthBreakdown": [
    {"label": "Architecture", "verdict": "good|warn|risk", "note": "1 sentence"},
    {"label": "Test coverage", "verdict": "good|warn|risk", "note": "1 sentence"},
    {"label": "Security posture", "verdict": "good|warn|risk", "note": "1 sentence"},
    {"label": "Documentation", "verdict": "good|warn|risk", "note": "1 sentence"},
    {"label": "Maintenance", "verdict": "good|warn|risk", "note": "1 sentence"}
  ],
  "architecture": [
    {"id":"frontend","label":"Frontend","kind":"frontend","explanation":"...","files":["..."]},
    {"id":"api","label":"API","kind":"api","explanation":"...","files":["..."]},
    {"id":"database","label":"Database","kind":"database","explanation":"...","files":["..."]},
    {"id":"external","label":"External Services","kind":"external","explanation":"...","files":["..."]}
  ],
  "folders": [
    {"path":"src/","summary":"...","role":"...","confidence":0-100}
    // 5-10 top-level or important folders
  ],
  "entryPoints": ["most useful files to read first, 4–6"],
  "risks": [
    {"title":"...","severity":"critical|warning|suggestion","note":"1–2 sentences"}
    // 3–6 items across severities
  ],
  "suggestedQuestions": ["4 concrete questions a new engineer would ask", "..."]
}
Only include architecture layers that actually exist. Score health honestly based on what you see (missing tests, no license, stale, missing docs → lower). Never invent files that aren't in the tree.`;
}

export const analyzeRepo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const started = Date.now();
    const parsed = parseRepoUrl(data.repoUrl);
    if (!parsed) throw new Error("Enter a valid GitHub URL (github.com/owner/repo).");
    if (data.provider !== "ollama" && !data.apiKey)
      throw new Error("API key required for the selected provider.");

    const meta = await fetchRepoMeta(parsed.owner, parsed.repo, data.githubToken);

    // ---- Server-side cache (per-worker, TTL 15min, invalidated by pushedAt) ----
    const cacheKey = `${parsed.owner}/${parsed.repo}::${data.model}::${meta.pushed_at}`;
    const hit = SERVER_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < SERVER_TTL_MS) {
      return {
        ...hit.value,
        perf: {
          latencyMs: Date.now() - started,
          servedFromCache: true,
          generatedAt: new Date(hit.ts).toISOString(),
        },
      };
    }

    const [langs, treeRes] = await Promise.all([
      fetchLanguages(parsed.owner, parsed.repo, data.githubToken),
      fetchTree(parsed.owner, parsed.repo, meta.default_branch, data.githubToken),
    ]);
    const paths = treeRes.tree
      .filter((t) => t.type === "blob")
      .map((t) => t.path);
    const dirs = topDirs(paths, 2);

    // Fetch a few key files (best-effort, in parallel, capped).
    const found: Record<string, string> = {};
    const candidates = KEY_FILE_CANDIDATES.filter((c) => paths.includes(c));
    await Promise.all(
      candidates.slice(0, 6).map(async (p) => {
        const t = await fetchFileText(
          parsed.owner,
          parsed.repo,
          p,
          meta.default_branch,
          data.githubToken,
          8_000,
        );
        if (t) found[p] = t;
      }),
    );

    const prompt = buildAnalysisPrompt({
      meta: {
        fullName: meta.full_name,
        description: meta.description,
        language: meta.language,
      },
      languages: langs,
      tree: shortenTree(paths),
      dirs,
      files: found,
    });

    let raw = "";
    try {
      raw = await callLLM({
        provider: data.provider as ProviderId,
        apiKey: data.apiKey,
        model: data.model,
        baseUrl: data.baseUrl,
        system: ANALYSIS_SYSTEM,
        user: prompt,
        json: true,
        maxTokens: 3500,
        temperature: 0.2,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`AI analysis failed. ${msg}`);
    }

    type AiPart = Omit<AnalysisResult, "meta" | "stats" | "keyFiles" | "timeline">;
    const fallback: AiPart = {
      overview:
        raw.trim().slice(0, 800) ||
        `${meta.full_name} is a ${meta.language ?? "software"} project. Automatic AI parsing failed, so this is a minimal summary based on repository metadata only.`,
      audience: "developers exploring this repository",
      complexity: "medium",
      learningCurve: "moderate",
      technologies: meta.language ? [meta.language] : [],
      healthScore: 60,
      healthBreakdown: [
        { label: "Documentation", verdict: "warn", note: "Could not fully assess — AI response was unparseable." },
        { label: "Maintenance", verdict: meta.pushed_at ? "good" : "warn", note: `Last push ${new Date(meta.pushed_at).toLocaleDateString()}.` },
        { label: "License", verdict: meta.license?.spdx_id ? "good" : "warn", note: meta.license?.spdx_id ?? "No license detected." },
      ],
      architecture: [],
      folders: [],
      entryPoints: candidates.slice(0, 4),
      risks: [],
      suggestedQuestions: [
        `What is ${meta.full_name} for?`,
        "Where does the entry point live?",
        "How do I run this locally?",
        "What are the main modules?",
      ],
    };

    let parsedJson: AiPart;
    try {
      parsedJson = extractJson<AiPart>(raw);
    } catch {
      parsedJson = fallback;
    }

    const result: AnalysisResult = {
      meta: {
        fullName: meta.full_name,
        description: meta.description,
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        openIssues: meta.open_issues_count,
        language: meta.language,
        license: meta.license?.spdx_id ?? null,
        pushedAt: meta.pushed_at,
        url: meta.html_url,
        ownerAvatar: meta.owner.avatar_url,
        defaultBranch: meta.default_branch,
        isPrivate: meta.private ?? false,
      },
      stats: {
        fileCount: paths.length,
        truncated: treeRes.truncated,
        languages: langs,
      },
      keyFiles: candidates,
      overview: parsedJson.overview,
      audience: parsedJson.audience,
      complexity: parsedJson.complexity,
      learningCurve: parsedJson.learningCurve,
      technologies: parsedJson.technologies ?? [],
      healthScore: Math.round(parsedJson.healthScore ?? 0),
      healthBreakdown: parsedJson.healthBreakdown ?? [],
      architecture: parsedJson.architecture ?? [],
      folders: parsedJson.folders ?? [],
      entryPoints: parsedJson.entryPoints ?? [],
      risks: parsedJson.risks ?? [],
      suggestedQuestions: parsedJson.suggestedQuestions ?? [],
      timeline: [
        `Cloned repository metadata (${meta.full_name})`,
        `Indexed ${paths.length}${treeRes.truncated ? "+" : ""} files`,
        `Detected primary language: ${meta.language ?? "unknown"}`,
        `Read ${Object.keys(found).length} key configuration files`,
        `Built knowledge graph`,
      ],
      perf: {
        latencyMs: Date.now() - started,
        servedFromCache: false,
        generatedAt: new Date().toISOString(),
      },
    };
    SERVER_CACHE.set(cacheKey, { value: result, ts: Date.now() });
    if (SERVER_CACHE.size > 64) {
      // simple LRU-ish eviction: drop oldest
      const first = SERVER_CACHE.keys().next().value;
      if (first) SERVER_CACHE.delete(first);
    }
    return result;
  });

// -------- Server-side in-memory cache (per worker instance) --------
const SERVER_TTL_MS = 15 * 60 * 1000;
const SERVER_CACHE = new Map<string, { value: AnalysisResult; ts: number }>();