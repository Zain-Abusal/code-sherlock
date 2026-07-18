import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const STEPS = [
  "Reading repository…",
  "Indexing file tree…",
  "Detecting stack & entry points…",
  "Reading key configuration files…",
  "Asking the model to think like a senior engineer…",
  "Mapping architecture…",
  "Building knowledge graph…",
];

interface Props {
  repoUrl: string;
  done?: boolean;
  error?: string | null;
}

export function SherlockLoading({ repoUrl, done, error }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (done || error) return;
    const id = setInterval(
      () => setI((n) => Math.min(n + 1, STEPS.length - 1)),
      1200,
    );
    return () => clearInterval(id);
  }, [done, error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-amber/40 animate-pulse-ring" />
        <span
          className="absolute inset-0 rounded-full border border-amber/30 animate-pulse-ring"
          style={{ animationDelay: "0.6s" }}
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber/50 shadow-[0_0_40px_-5px_var(--amber)]">
          <span className="font-display text-3xl text-background">S</span>
        </div>
      </div>

      <p className="font-mono-tight text-xs uppercase tracking-[0.3em] text-amber">
        Meet Sherlock
      </p>
      <h2 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
        Reading{" "}
        <span className="ink-underline">{repoUrl.replace(/^https?:\/\//, "")}</span>
      </h2>

      <ul className="mt-10 w-full space-y-2 text-left">
        {STEPS.map((s, idx) => {
          const state =
            error && idx === i
              ? "error"
              : done || idx < i
                ? "done"
                : idx === i
                  ? "active"
                  : "pending";
          return (
            <li
              key={s}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-all ${
                state === "active"
                  ? "border-amber/50 bg-amber/5 shimmer"
                  : state === "done"
                    ? "border-emerald/30 bg-emerald/5"
                    : state === "error"
                      ? "border-crimson/50 bg-crimson/10"
                      : "border-border/30 bg-transparent opacity-50"
              }`}
            >
              {state === "done" ? (
                <Check className="h-4 w-4 text-emerald" />
              ) : state === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber" />
              ) : state === "error" ? (
                <span className="h-4 w-4 rounded-full bg-crimson" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-border" />
              )}
              <span className="font-mono-tight text-sm">{s}</span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-6 rounded-md border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson">
          {error}
        </p>
      )}
    </div>
  );
}