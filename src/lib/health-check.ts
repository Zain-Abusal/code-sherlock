// Client-side provider health checks — cheap ping, no billable tokens where possible.
// Uses the user's own API key so we never proxy credentials through our server.
import type { ProviderId } from "./providers";

export interface HealthResult {
  provider: ProviderId;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  detail: string;
}

interface Args {
  provider: ProviderId;
  apiKey: string;
  baseUrl?: string;
}

function endpoint(provider: ProviderId, baseUrl?: string): string {
  const base = baseUrl?.replace(/\/+$/, "");
  switch (provider) {
    case "openai":
      return `${base ?? "https://api.openai.com/v1"}/models`;
    case "groq":
      return `${base ?? "https://api.groq.com/openai/v1"}/models`;
    case "openrouter":
      return `${base ?? "https://openrouter.ai/api/v1"}/models`;
    case "ollama":
      return `${base ?? "http://localhost:11434"}/api/tags`;
    case "anthropic":
      return "https://api.anthropic.com/v1/models";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/models";
  }
}

function headers(provider: ProviderId, apiKey: string): HeadersInit {
  if (provider === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  if (provider === "gemini") return {};
  if (provider === "ollama" && !apiKey) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

export async function pingProvider(args: Args): Promise<HealthResult> {
  const start = performance.now();
  const url =
    args.provider === "gemini"
      ? `${endpoint("gemini")}?key=${encodeURIComponent(args.apiKey)}`
      : endpoint(args.provider, args.baseUrl);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: headers(args.provider, args.apiKey),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return {
        provider: args.provider,
        ok: true,
        status: res.status,
        latencyMs,
        detail: `Reachable in ${latencyMs}ms`,
      };
    }
    const body = (await res.text()).slice(0, 160);
    return {
      provider: args.provider,
      ok: false,
      status: res.status,
      latencyMs,
      detail: friendly(res.status, body),
    };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      provider: args.provider,
      ok: false,
      status: null,
      latencyMs,
      detail:
        e instanceof Error
          ? `Network error: ${e.message}`
          : "Network error (CORS or offline).",
    };
  }
}

function friendly(status: number, body: string): string {
  if (status === 401 || status === 403) return "Key rejected — check permissions.";
  if (status === 404) return "Endpoint not found — check base URL.";
  if (status === 429) return "Rate limited — try again shortly.";
  if (status >= 500) return "Upstream service is down.";
  return body || `HTTP ${status}`;
}