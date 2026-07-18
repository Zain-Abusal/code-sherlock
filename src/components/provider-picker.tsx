import { useEffect, useState } from "react";
import { KeyRound, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVIDERS, getProvider, type ProviderId } from "@/lib/providers";

export interface ProviderState {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  githubToken?: string;
}

const STORAGE_KEY = "codesherlock.provider.v1";

export function loadProviderState(): ProviderState {
  if (typeof window === "undefined") {
    return { provider: "openai", apiKey: "", model: "gpt-4o-mini" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProviderState;
  } catch {
    /* ignore */
  }
  return { provider: "openai", apiKey: "", model: "gpt-4o-mini" };
}

export function saveProviderState(s: ProviderState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

interface Props {
  value: ProviderState;
  onChange: (s: ProviderState) => void;
}

export function ProviderPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProviderState>(value);

  useEffect(() => setDraft(value), [value, open]);

  const cfg = getProvider(draft.provider);
  const isConfigured =
    (cfg.needsKey ? value.apiKey.length > 0 : true) && value.model.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="gap-2 border-border/60 bg-card/60 backdrop-blur"
        >
          <KeyRound className="h-4 w-4 text-amber" />
          <span className="font-mono-tight text-xs uppercase tracking-wider">
            {getProvider(value.provider).label}
          </span>
          <span
            className={`ml-1 h-1.5 w-1.5 rounded-full ${
              isConfigured ? "bg-emerald" : "bg-crimson"
            }`}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Bring your own model
          </DialogTitle>
          <DialogDescription>
            Your key is stored only in this browser and sent to your chosen provider
            per request. Never persisted on our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={draft.provider}
              onValueChange={(v) => {
                const p = getProvider(v as ProviderId);
                setDraft({
                  ...draft,
                  provider: p.id,
                  model: p.defaultModel,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Model</Label>
            <Input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder={cfg.defaultModel}
              className="font-mono-tight"
            />
            <div className="flex flex-wrap gap-1.5">
              {cfg.modelSuggestions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDraft({ ...draft, model: m })}
                  className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-xs font-mono-tight text-muted-foreground hover:border-amber hover:text-amber transition"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {cfg.needsKey && (
            <div className="grid gap-2">
              <Label>
                API key{" "}
                <a
                  href={cfg.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber underline-offset-4 hover:underline"
                >
                  where to find it →
                </a>
              </Label>
              <Input
                type="password"
                value={draft.apiKey}
                autoComplete="off"
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-…"
                className="font-mono-tight"
              />
            </div>
          )}

          {(draft.provider === "ollama" || draft.provider === "openrouter") && (
            <div className="grid gap-2">
              <Label>Base URL (optional)</Label>
              <Input
                value={draft.baseUrl ?? ""}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder={cfg.baseUrlHint ?? ""}
                className="font-mono-tight"
              />
              {draft.provider === "ollama" && (
                <p className="text-xs text-muted-foreground">
                  Ollama on localhost is unreachable from our servers. Expose it
                  via a tunnel (e.g. ngrok) and paste the public URL here.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label>GitHub token (optional, raises rate limits)</Label>
            <Input
              type="password"
              value={draft.githubToken ?? ""}
              autoComplete="off"
              onChange={(e) =>
                setDraft({ ...draft, githubToken: e.target.value })
              }
              placeholder="ghp_…"
              className="font-mono-tight"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onChange(draft);
              saveProviderState(draft);
              setOpen(false);
            }}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}