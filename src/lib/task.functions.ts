import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const TaskKind = z.enum([
  "bugs",
  "refactor",
  "docs",
  "learning",
  "roadmap",
  "chat",
]);

const TaskInput = z.object({
  kind: TaskKind,
  repoContext: z.string().min(10),
  provider: ProviderEnum,
  apiKey: z.string().default(""),
  model: z.string().min(1),
  baseUrl: z.string().optional(),
  // extras
  question: z.string().optional(),
  learningLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  docKind: z
    .enum(["readme", "contributing", "api", "onboarding"])
    .optional(),
});

export type TaskInputT = z.infer<typeof TaskInput>;

const SYSTEM = `You are CodeSherlock, a senior engineer. Be concise, concrete, and cite file paths from the provided repository context whenever possible. When asked for JSON, return ONLY valid JSON matching the schema.`;

function promptFor(input: TaskInputT): { user: string; json: boolean; maxTokens: number } {
  const ctx = input.repoContext;
  switch (input.kind) {
    case "bugs":
      return {
        json: true,
        maxTokens: 1600,
        user: `Given this repository snapshot:\n${ctx}\n\nHunt likely bugs, security risks, and code smells. Return JSON:\n{"items":[{"title":"...","severity":"critical|warning|suggestion","reason":"...","files":["..."],"fix":"suggested AI fix, 2-4 sentences"}]}\nInclude 4–10 items, ordered by severity.`,
      };
    case "refactor":
      return {
        json: true,
        maxTokens: 1600,
        user: `Given this repository snapshot:\n${ctx}\n\nSuggest a refactor plan. Return JSON:\n{"restructure":[{"from":"...","to":"...","why":"..."}],"duplication":[{"where":"...","note":"..."}],"naming":[{"file":"...","suggestion":"..."}],"performance":[{"where":"...","suggestion":"..."}]}`,
      };
    case "docs": {
      const kind = input.docKind ?? "readme";
      const target =
        kind === "readme"
          ? "a polished README.md"
          : kind === "contributing"
            ? "a CONTRIBUTING.md"
            : kind === "api"
              ? "API documentation in markdown"
              : "an onboarding guide for a new engineer";
      return {
        json: false,
        maxTokens: 2200,
        user: `Given this repository snapshot:\n${ctx}\n\nWrite ${target}. Use clear headings, code blocks, and cite real file paths where useful. Output raw markdown only.`,
      };
    }
    case "learning": {
      const lvl = input.learningLevel ?? "beginner";
      return {
        json: false,
        maxTokens: 1800,
        user: `Given this repository snapshot:\n${ctx}\n\nTeach this project to a ${lvl} developer. Provide: 1) what it does, 2) how it fits together, 3) a guided reading order with file paths, 4) 3 exercises to try. Output markdown.`,
      };
    }
    case "roadmap":
      return {
        json: true,
        maxTokens: 1400,
        user: `Given this repository snapshot:\n${ctx}\n\nPropose what to build next. Return JSON:\n{"items":[{"title":"...","priority":"P0|P1|P2","effort":"S|M|L","businessValue":"...","why":"..."}]}\nInclude 5–8 items ordered by priority.`,
      };
    case "chat":
      return {
        json: false,
        maxTokens: 1200,
        user: `Repository snapshot:\n${ctx}\n\nUser question: ${input.question ?? ""}\n\nAnswer clearly. Cite file paths in \`backticks\` whenever they support your answer. If unsure, say so.`,
      };
  }
}

export const runTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TaskInput.parse(data))
  .handler(async ({ data }) => {
    const started = Date.now();
    if (data.provider !== "ollama" && !data.apiKey)
      throw new Error("API key required for the selected provider.");
    const p = promptFor(data);
    const raw = await callLLM({
      provider: data.provider as ProviderId,
      apiKey: data.apiKey,
      model: data.model,
      baseUrl: data.baseUrl,
      system: SYSTEM,
      user: p.user,
      json: p.json,
      maxTokens: p.maxTokens,
      temperature: data.kind === "chat" ? 0.4 : 0.3,
    });
    const latencyMs = Date.now() - started;
    if (p.json) {
      try {
        const parsed = extractJson(raw);
        return {
          kind: data.kind,
          jsonString: JSON.stringify(parsed),
          text: null as string | null,
          latencyMs,
        };
      } catch {
        return { kind: data.kind, jsonString: null as string | null, text: raw, latencyMs };
      }
    }
    return { kind: data.kind, jsonString: null as string | null, text: raw, latencyMs };
  });