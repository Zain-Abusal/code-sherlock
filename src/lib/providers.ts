export type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "openrouter"
  | "ollama";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  defaultModel: string;
  modelSuggestions: string[];
  needsKey: boolean;
  baseUrlHint?: string;
  docsUrl: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    modelSuggestions: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
    needsKey: true,
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-3-5-haiku-latest",
    modelSuggestions: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-sonnet-4-20250514"],
    needsKey: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    modelSuggestions: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
    needsKey: true,
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    modelSuggestions: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    needsKey: true,
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "anthropic/claude-3.5-haiku",
    modelSuggestions: ["anthropic/claude-3.5-haiku", "openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-001"],
    needsKey: true,
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "ollama",
    label: "Local Ollama",
    defaultModel: "llama3.2",
    modelSuggestions: ["llama3.2", "qwen2.5-coder:7b", "deepseek-coder-v2"],
    needsKey: false,
    baseUrlHint: "https://your-tunnel.example.com",
    docsUrl: "https://ollama.com",
  },
];

export function getProvider(id: ProviderId): ProviderConfig {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}