// Server-only: unified LLM caller across providers.
import type { ProviderId } from "./providers";

export interface LLMCallInput {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export async function callLLM(input: LLMCallInput): Promise<string> {
  const { provider } = input;
  if (provider === "anthropic") return callAnthropic(input);
  if (provider === "gemini") return callGemini(input);
  return callOpenAICompatible(input);
}

function friendlyError(provider: string, status: number, body: string): Error {
  const snippet = body.slice(0, 300);
  if (status === 401 || status === 403) {
    return new Error(
      `${provider}: API key was rejected (${status}). Double-check the key in the top-right settings — it may be invalid, expired, or missing permissions.`,
    );
  }
  if (status === 404) {
    return new Error(
      `${provider}: Model not found. The model ID you selected may not exist or your key can't access it. Try a different model.`,
    );
  }
  if (status === 429) {
    return new Error(
      `${provider}: Rate limit or quota exceeded. Wait a moment and try again, or switch to a different provider.`,
    );
  }
  if (status >= 500) {
    return new Error(
      `${provider}: Upstream service is temporarily unavailable (${status}). Retry in a few seconds.`,
    );
  }
  return new Error(`${provider} ${status}: ${snippet}`);
}

function openAiCompatibleBase(input: LLMCallInput): string {
  if (input.baseUrl) return input.baseUrl.replace(/\/+$/, "");
  switch (input.provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "ollama":
      return "http://localhost:11434/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

async function callOpenAICompatible(input: LLMCallInput): Promise<string> {
  const base = openAiCompatibleBase(input);
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    temperature: input.temperature ?? 0.3,
  };
  if (input.maxTokens) body.max_tokens = input.maxTokens;
  if (input.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;
  if (input.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://codesherlock.ai";
    headers["X-Title"] = "CodeSherlock";
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw friendlyError(input.provider, res.status, text);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(input: LLMCallInput): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 2048,
      temperature: input.temperature ?? 0.3,
      system: input.system + (input.json ? "\n\nReturn ONLY valid JSON. No prose, no markdown fences." : ""),
      messages: [{ role: "user", content: input.user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw friendlyError("anthropic", res.status, text);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

async function callGemini(input: LLMCallInput): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    input.model,
  )}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.3,
        maxOutputTokens: input.maxTokens ?? 2048,
        ...(input.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw friendlyError("gemini", res.status, text);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    ""
  );
}

export function extractJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      return JSON.parse(candidate.slice(first, last + 1)) as T;
    }
    throw new Error("Model did not return valid JSON");
  }
}