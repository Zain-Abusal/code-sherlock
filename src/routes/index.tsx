import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Github, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dashboard } from "@/components/dashboard";
import {
  ProviderPicker,
  loadProviderState,
  type ProviderState,
} from "@/components/provider-picker";
import { SherlockLoading } from "@/components/sherlock-loading";
import {
  analyzeRepo,
  type AnalysisResult,
} from "@/lib/analyze.functions";
import { PROVIDERS } from "@/lib/providers";

export const Route = createFileRoute("/")({
  component: Index,
});

type Phase =
  | { kind: "hero" }
  | { kind: "loading"; repoUrl: string; error: string | null }
  | { kind: "ready"; analysis: AnalysisResult };

function Index() {
  const [phase, setPhase] = useState<Phase>({ kind: "hero" });
  const [repoUrl, setRepoUrl] = useState("");
  const [provider, setProvider] = useState<ProviderState>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [heroError, setHeroError] = useState<string | null>(null);

  useEffect(() => {
    setProvider(loadProviderState());
  }, []);

  const analyze = async () => {
    const url = repoUrl.trim();
    if (!url) {
      setHeroError("Paste a GitHub URL first.");
      return;
    }
    if (provider.provider !== "ollama" && !provider.apiKey) {
      setHeroError("Add your API key to continue (top-right).");
      return;
    }
    setHeroError(null);
    setPhase({ kind: "loading", repoUrl: url, error: null });
    try {
      const analysis = await analyzeRepo({
        data: {
          repoUrl: url,
          provider: provider.provider,
          apiKey: provider.apiKey,
          model: provider.model,
          baseUrl: provider.baseUrl,
          githubToken: provider.githubToken,
        },
      });
      setPhase({ kind: "ready", analysis });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "loading", repoUrl: url, error: msg });
    }
  };

  if (phase.kind === "ready") {
    return (
      <Dashboard
        analysis={phase.analysis}
        provider={provider}
        onReset={() => {
          setPhase({ kind: "hero" });
          setRepoUrl("");
        }}
      />
    );
  }

  if (phase.kind === "loading") {
    return (
      <div>
        <TopNav provider={provider} setProvider={setProvider} />
        <SherlockLoading repoUrl={phase.repoUrl} error={phase.error} />
        {phase.error && (
          <div className="mx-auto mt-4 max-w-2xl px-6 text-center">
            <Button
              variant="outline"
              onClick={() => setPhase({ kind: "hero" })}
            >
              Try another repository
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav provider={provider} setProvider={setProvider} />

      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-20 pt-16 text-center md:pt-28">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-mono-tight uppercase tracking-[0.25em] text-amber backdrop-blur">
          <Sparkles className="h-3 w-3" />
          Your senior engineer, on tap
        </div>

        <h1 className="mt-6 font-display text-6xl leading-[0.95] tracking-tight text-foreground md:text-8xl">
          Understand any
          <br />
          <span className="italic text-amber">codebase</span> in{" "}
          <span className="ink-underline">60 seconds</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Drop a GitHub URL. Sherlock reads the repo, maps the architecture, hunts
          bugs, drafts docs, and answers questions — cited to real files.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            analyze();
          }}
          className="mt-10 w-full max-w-2xl"
        >
          <div className="glass-card flex items-center gap-2 rounded-xl p-2">
            <div className="pl-3 text-muted-foreground">
              <Github className="h-5 w-5" />
            </div>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/vercel/next.js"
              className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="lg" className="gap-1 whitespace-nowrap">
              Analyze
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {heroError && (
            <div className="mt-3 text-sm text-crimson">{heroError}</div>
          )}
          <div className="mt-3 text-xs font-mono-tight text-muted-foreground">
            try{" "}
            {["facebook/react", "vercel/next.js", "tanstack/router"].map(
              (r, i) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRepoUrl(`https://github.com/${r}`)}
                  className="text-amber underline-offset-4 hover:underline"
                >
                  {r}
                  {i < 2 ? ", " : ""}
                </button>
              ),
            )}
          </div>
        </form>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono-tight uppercase tracking-widest text-muted-foreground">
          <span>Works with</span>
          {PROVIDERS.map((p) => (
            <span key={p.id} className="text-foreground/70">
              {p.label}
            </span>
          ))}
          <span className="text-amber">no vendor lock-in</span>
        </div>

        <FeatureGrid />
      </main>
    </div>
  );
}

function TopNav({
  provider,
  setProvider,
}: {
  provider: ProviderState;
  setProvider: (s: ProviderState) => void;
}) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-amber to-amber/50 font-display text-lg text-background">
          S
        </span>
        <div className="leading-tight">
          <div className="font-display text-lg">CodeSherlock</div>
          <div className="text-[10px] font-mono-tight uppercase tracking-[0.25em] text-muted-foreground">
            AI · Repository Detective
          </div>
        </div>
      </div>
      <ProviderPicker value={provider} onChange={setProvider} />
    </header>
  );
}

const FEATURES = [
  { title: "Architecture map", body: "Interactive layered view of frontend, API, database, and integrations." },
  { title: "Bug hunter", body: "Categorized critical / warning / suggestion, each with a proposed fix." },
  { title: "Ask anything", body: "Chat scoped to the repo. Every answer cites real file paths." },
  { title: "Refactor mode", body: "Folder restructuring, duplicated code, naming, performance wins." },
  { title: "Documentation", body: "One click for README, CONTRIBUTING, API docs, or onboarding." },
  { title: "Learning mode", body: "Beginner / intermediate / advanced — Sherlock adapts." },
];

function FeatureGrid() {
  return (
    <div className="mt-20 grid w-full gap-3 text-left md:grid-cols-3">
      {FEATURES.map((f) => (
        <div key={f.title} className="glass-card rounded-xl p-5">
          <div className="font-display text-xl text-foreground">{f.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{f.body}</div>
        </div>
      ))}
    </div>
  );
}
