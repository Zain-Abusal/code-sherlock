import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bug,
  ChevronRight,
  Compass,
  Download,
  FileText,
  GitBranch,
  GraduationCap,
  Lock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rocket,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type { AnalysisResult } from "@/lib/analyze.functions";
import type { ProviderState } from "@/components/provider-picker";
import { runTask, type TaskInputT } from "@/lib/task.functions";
import { downloadAnalysisPdf } from "@/lib/pdf-report";
import { getCachedTask, saveTask } from "@/lib/analysis-cache";
import { downloadAudit, listAudit, logAudit, clearAudit } from "@/lib/audit-log";

interface Props {
  analysis: AnalysisResult;
  provider: ProviderState;
  repoUrl: string;
  onReset: () => void;
  onReanalyze?: () => void;
}

function useRepoContext(a: AnalysisResult): string {
  return useMemo(() => {
    const folders = a.folders.map((f) => `- ${f.path}: ${f.role}`).join("\n");
    const arch = a.architecture
      .map((n) => `- ${n.label} (${n.kind}): ${n.explanation}`)
      .join("\n");
    return `Repo: ${a.meta.fullName}
Description: ${a.meta.description ?? ""}
Language: ${a.meta.language ?? "?"}
Technologies: ${a.technologies.join(", ")}

Architecture:
${arch}

Key folders:
${folders}

Entry points: ${a.entryPoints.join(", ")}
Overview: ${a.overview}`;
  }, [a]);
}

function scoreColor(n: number): string {
  if (n >= 80) return "text-emerald";
  if (n >= 60) return "text-amber";
  return "text-crimson";
}

export function Dashboard({ analysis, provider, repoUrl, onReset, onReanalyze }: Props) {
  const repoContext = useRepoContext(analysis);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-8"
    >
      <TopBar
        analysis={analysis}
        onReset={onReset}
        onReanalyze={onReanalyze}
        onDownload={() => {
          downloadAnalysisPdf(analysis);
          logAudit({
            kind: "pdf_export",
            repo: analysis.meta.fullName,
            ok: true,
            detail: "PDF intelligence report",
          });
        }}
      />
      <Hero analysis={analysis} />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <HealthCard analysis={analysis} />
        <div className="glass-card md:col-span-2 rounded-xl p-6 animate-glass-in">
          <SectionTitle icon={<Sparkles className="h-4 w-4" />} label="AI Overview" />
          <p className="mt-3 leading-relaxed text-foreground/90">{analysis.overview}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Meta label="Built for" value={analysis.audience} />
            <Meta label="Complexity" value={analysis.complexity} />
            <Meta label="Learning curve" value={analysis.learningCurve} />
            <Meta label="License" value={analysis.meta.license ?? "None"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {analysis.technologies.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-xs font-mono-tight text-foreground/80"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ArchitectureMap analysis={analysis} />
      <FolderExplorer analysis={analysis} />
      <RiskStrip analysis={analysis} />

      <div className="mt-8">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabTrigger value="chat" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Ask Anything" />
            <TabTrigger value="bugs" icon={<Bug className="h-3.5 w-3.5" />} label="Bug Hunter" />
            <TabTrigger value="refactor" icon={<Wrench className="h-3.5 w-3.5" />} label="Refactor" />
            <TabTrigger value="docs" icon={<FileText className="h-3.5 w-3.5" />} label="Documentation" />
            <TabTrigger value="learning" icon={<GraduationCap className="h-3.5 w-3.5" />} label="Learning" />
            <TabTrigger value="roadmap" icon={<Rocket className="h-3.5 w-3.5" />} label="What's Next" />
            <TabTrigger value="audit" icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Audit Trail" />
          </TabsList>

          <TabsContent value="chat">
            <ChatPanel analysis={analysis} provider={provider} repoContext={repoContext} />
          </TabsContent>
          <TabsContent value="bugs">
            <BugPanel provider={provider} repoContext={repoContext} repoUrl={repoUrl} repoName={analysis.meta.fullName} />
          </TabsContent>
          <TabsContent value="refactor">
            <RefactorPanel provider={provider} repoContext={repoContext} repoUrl={repoUrl} repoName={analysis.meta.fullName} />
          </TabsContent>
          <TabsContent value="docs">
            <DocsPanel provider={provider} repoContext={repoContext} repoName={analysis.meta.fullName} />
          </TabsContent>
          <TabsContent value="learning">
            <LearningPanel provider={provider} repoContext={repoContext} repoName={analysis.meta.fullName} />
          </TabsContent>
          <TabsContent value="roadmap">
            <RoadmapPanel provider={provider} repoContext={repoContext} repoUrl={repoUrl} repoName={analysis.meta.fullName} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function TopBar({
  analysis,
  onReset,
  onReanalyze,
  onDownload,
}: {
  analysis: AnalysisResult;
  onReset: () => void;
  onReanalyze?: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button onClick={onReset} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-amber to-amber/50 font-display text-background">
          S
        </span>
        <span className="font-mono-tight uppercase tracking-widest">CodeSherlock</span>
        <ChevronRight className="h-3 w-3 opacity-60 transition group-hover:translate-x-0.5" />
        <span className="font-mono-tight">new investigation</span>
      </button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          className="gap-1.5 font-mono-tight text-xs uppercase tracking-wider"
        >
          <Download className="h-3.5 w-3.5" />
          Report PDF
        </Button>
        {onReanalyze && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReanalyze}
            title="Re-run analysis (bypass cache)"
            className="gap-1.5 font-mono-tight text-xs uppercase tracking-wider text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
        <a
          href={analysis.meta.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-mono-tight text-muted-foreground backdrop-blur transition hover:border-amber/60 hover:text-amber"
        >
          <GitBranch className="h-3.5 w-3.5" />
          {analysis.meta.fullName}
        </a>
      </div>
    </div>
  );
}

function Hero({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="mt-8 animate-glass-in">
      <div className="flex items-center gap-2 text-xs font-mono-tight uppercase tracking-[0.3em] text-amber">
        <span>Case file #{analysis.meta.fullName.length.toString().padStart(4, "0")}</span>
        {analysis.meta.isPrivate && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber">
            <Lock className="h-3 w-3" aria-hidden /> private
          </span>
        )}
        {analysis.perf?.servedFromCache && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald/40 bg-emerald/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-emerald">
            server cache · {analysis.perf.latencyMs}ms
          </span>
        )}
      </div>
      <h1 className="mt-2 font-display text-5xl leading-[1.05] text-foreground md:text-6xl">
        {analysis.meta.fullName}
      </h1>
      {analysis.meta.description && (
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
          {analysis.meta.description}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-mono-tight text-muted-foreground">
        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber" /> {analysis.meta.stars.toLocaleString()}</span>
        <span>⑂ {analysis.meta.forks.toLocaleString()}</span>
        <span>{analysis.stats.fileCount}{analysis.stats.truncated ? "+" : ""} files</span>
        <span>last push {new Date(analysis.meta.pushedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function HealthCard({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="glass-card rounded-xl p-6 animate-glass-in">
      <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} label="Health Score" />
      <div className="mt-4 flex items-end gap-2">
        <span className={`font-display text-7xl leading-none ${scoreColor(analysis.healthScore)}`}>
          {analysis.healthScore}
        </span>
        <span className="pb-2 font-mono-tight text-sm text-muted-foreground">/ 100</span>
      </div>
      <ul className="mt-4 space-y-1.5">
        {analysis.healthBreakdown.map((h) => (
          <li key={h.label} className="flex items-center gap-2 text-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                h.verdict === "good"
                  ? "bg-emerald"
                  : h.verdict === "warn"
                    ? "bg-amber"
                    : "bg-crimson"
              }`}
            />
            <span className="text-foreground/90">{h.label}</span>
            <span className="ml-auto text-xs text-muted-foreground text-right max-w-[55%]">{h.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchitectureMap({ analysis }: { analysis: AnalysisResult }) {
  const [active, setActive] = useState<string | null>(null);
  const nodes = analysis.architecture;
  const activeNode = nodes.find((n) => n.id === active);
  return (
    <div className="glass-card mt-6 rounded-xl p-6 animate-glass-in">
      <SectionTitle icon={<Compass className="h-4 w-4" />} label="Architecture Map" />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {nodes.map((n, i) => (
          <button
            key={n.id}
            onClick={() => setActive((a) => (a === n.id ? null : n.id))}
            className={`group text-left rounded-lg border p-4 transition ${
              active === n.id
                ? "border-amber bg-amber/5"
                : "border-border/60 bg-background/40 hover:border-amber/60"
            }`}
          >
            <div className="text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground">
              layer {i + 1}
            </div>
            <div className="mt-1 font-display text-xl text-foreground">{n.label}</div>
            <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {n.explanation}
            </div>
            <ArrowRight className="mt-3 h-3.5 w-3.5 text-amber opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>
      {activeNode && (
        <div className="mt-4 rounded-lg border border-amber/30 bg-amber/5 p-4 text-sm">
          <p className="text-foreground/90">{activeNode.explanation}</p>
          {activeNode.files && activeNode.files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeNode.files.map((f) => (
                <span
                  key={f}
                  className="rounded border border-border/60 bg-background/60 px-2 py-0.5 text-xs font-mono-tight text-foreground/80"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderExplorer({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="glass-card mt-6 rounded-xl p-6 animate-glass-in">
      <SectionTitle icon={<GitBranch className="h-4 w-4" />} label="Folder Explorer" />
      <div className="mt-4 divide-y divide-border/50">
        {analysis.folders.map((f) => (
          <div key={f.path} className="grid gap-2 py-3 md:grid-cols-[220px_1fr_auto] md:items-center">
            <span className="font-mono-tight text-sm text-amber">{f.path}</span>
            <div>
              <div className="text-sm text-foreground/90">{f.summary}</div>
              <div className="text-xs text-muted-foreground">{f.role}</div>
            </div>
            <span className="justify-self-start md:justify-self-end text-xs font-mono-tight text-muted-foreground">
              confidence {f.confidence}%
            </span>
          </div>
        ))}
      </div>
      {analysis.entryPoints.length > 0 && (
        <div className="mt-5 rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="text-xs font-mono-tight uppercase tracking-widest text-muted-foreground">
            Read these first
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {analysis.entryPoints.map((e) => (
              <span
                key={e}
                className="rounded-md border border-amber/40 bg-amber/5 px-2 py-1 text-xs font-mono-tight text-amber"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskStrip({ analysis }: { analysis: AnalysisResult }) {
  if (!analysis.risks.length) return null;
  const dot = (s: string) =>
    s === "critical" ? "bg-crimson" : s === "warning" ? "bg-amber" : "bg-emerald";
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      {analysis.risks.slice(0, 6).map((r, i) => (
        <div key={i} className="glass-card rounded-xl p-4 animate-glass-in">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dot(r.severity)}`} />
            <span className="text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground">
              {r.severity}
            </span>
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">{r.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{r.note}</div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono-tight uppercase tracking-[0.25em] text-amber">
      {icon} {label}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/30 p-2.5">
      <div className="text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm capitalize text-foreground/90">{value}</div>
    </div>
  );
}

function TabTrigger({
  value,
  icon,
  label,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="gap-1.5 rounded-md border border-border/50 bg-card/40 px-3 py-1.5 font-mono-tight text-xs uppercase tracking-wider data-[state=active]:border-amber data-[state=active]:bg-amber/10 data-[state=active]:text-amber"
    >
      {icon}
      {label}
    </TabsTrigger>
  );
}

/* ------------------------------ Panels ------------------------------ */

function useTaskCall(_provider: ProviderState) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = async (args: TaskInputT, meta?: { repo?: string }) => {
    setLoading(true);
    setError(null);
    const started = Date.now();
    try {
      const res = await runTask({ data: args });
      logAudit({
        kind: args.kind === "chat" ? "chat" : "task",
        provider: args.provider,
        model: args.model,
        repo: meta?.repo,
        ok: true,
        latencyMs:
          (res as { latencyMs?: number }).latencyMs ?? Date.now() - started,
        detail: args.kind,
      });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      logAudit({
        kind: "error",
        provider: args.provider,
        model: args.model,
        repo: meta?.repo,
        ok: false,
        latencyMs: Date.now() - started,
        detail: `${args.kind}: ${msg.slice(0, 120)}`,
      });
      throw e;
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, call, setError };
}

function PanelShell({
  children,
  loading,
  error,
  empty,
  actions,
}: {
  children?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="glass-card mt-4 border-0 p-0">
      <CardContent className="p-6">
        {actions && <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div>}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-amber" /> Sherlock is thinking…
          </div>
        )}
        {error && (
          <div className="rounded-md border border-crimson/40 bg-crimson/10 p-3 text-sm text-crimson">
            {error}
          </div>
        )}
        {!loading && !error && !children && empty}
        {!loading && !error && children}
      </CardContent>
    </Card>
  );
}

function baseArgs(provider: ProviderState, repoContext: string) {
  return {
    provider: provider.provider,
    apiKey: provider.apiKey,
    model: provider.model,
    baseUrl: provider.baseUrl,
    repoContext,
  };
}

/* Chat */
function ChatPanel({
  analysis,
  provider,
  repoContext,
}: {
  analysis: AnalysisResult;
  provider: ProviderState;
  repoContext: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const { loading, error, call } = useTaskCall(provider);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    try {
      const res = await call(
        { ...baseArgs(provider, repoContext), kind: "chat", question },
        { repo: analysis.meta.fullName },
      );
      setMessages((m) => [...m, { role: "assistant", text: res.text ?? "…" }]);
    } catch {
      /* handled */
    }
  };

  return (
    <PanelShell error={error}>
      {messages.length === 0 && (
        <div>
          <p className="text-sm text-muted-foreground">
            Ask Sherlock anything about this repository. Answers cite file paths.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-foreground/90 hover:border-amber hover:text-amber"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 text-sm ${
              m.role === "user"
                ? "border-amber/40 bg-amber/5 ml-8"
                : "border-border/60 bg-background/40 mr-8"
            }`}
          >
            <div className="mb-1 text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground">
              {m.role === "user" ? "you" : "Sherlock"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="mr-8 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-amber" /> thinking…
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Where is authentication handled?"
          className="bg-background/60"
        />
        <Button type="submit" disabled={loading || !input.trim()} className="gap-1">
          <Send className="h-4 w-4" />
          Ask
        </Button>
      </form>
    </PanelShell>
  );
}

function BugPanel({
  provider,
  repoContext,
  repoUrl,
  repoName,
}: {
  provider: ProviderState;
  repoContext: string;
  repoUrl: string;
  repoName?: string;
}) {
  const [items, setItems] = useState<
    | null
    | {
        title: string;
        severity: "critical" | "warning" | "suggestion";
        reason: string;
        files?: string[];
        fix?: string;
      }[]
  >(() => getCachedTask(repoUrl, provider.model, "bugs"));
  const { loading, error, call } = useTaskCall(provider);

  const run = async () => {
    const res = await call({ ...baseArgs(provider, repoContext), kind: "bugs" }, { repo: repoName });
    if (res.jsonString) {
      const parsed = JSON.parse(res.jsonString) as { items?: typeof items };
      const next = parsed.items ?? [];
      setItems(next);
      saveTask(repoUrl, provider.model, "bugs", next);
    }
  };

  const dot = (s: string) =>
    s === "critical" ? "bg-crimson" : s === "warning" ? "bg-amber" : "bg-emerald";
  const label = (s: string) => (s === "critical" ? "🔴 Critical" : s === "warning" ? "🟡 Warning" : "🟢 Suggestion");

  return (
    <PanelShell
      loading={loading}
      error={error}
      actions={<Button onClick={run} className="gap-2"><Bug className="h-4 w-4" /> Hunt bugs</Button>}
      empty={<p className="text-sm text-muted-foreground">Click "Hunt bugs" to scan for risks. Runs one AI call.</p>}
    >
      {items && (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dot(it.severity)}`} />
                <span className="text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground">
                  {label(it.severity)}
                </span>
              </div>
              <div className="mt-2 font-medium text-foreground">{it.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{it.reason}</div>
              {it.files && it.files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {it.files.map((f) => (
                    <span key={f} className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[11px] font-mono-tight text-foreground/80">
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {it.fix && (
                <div className="mt-3 rounded-md border border-amber/30 bg-amber/5 p-2 text-sm text-foreground/90">
                  <span className="text-[10px] font-mono-tight uppercase tracking-widest text-amber">AI fix</span>
                  <div className="mt-1">{it.fix}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function RefactorPanel({
  provider,
  repoContext,
  repoUrl,
  repoName,
}: {
  provider: ProviderState;
  repoContext: string;
  repoUrl: string;
  repoName?: string;
}) {
  const [data, setData] = useState<null | {
    restructure?: { from: string; to: string; why: string }[];
    duplication?: { where: string; note: string }[];
    naming?: { file: string; suggestion: string }[];
    performance?: { where: string; suggestion: string }[];
  }>(() => getCachedTask(repoUrl, provider.model, "refactor"));
  const { loading, error, call } = useTaskCall(provider);
  const run = async () => {
    const res = await call({ ...baseArgs(provider, repoContext), kind: "refactor" }, { repo: repoName });
    if (res.jsonString) {
      const parsed = JSON.parse(res.jsonString);
      setData(parsed);
      saveTask(repoUrl, provider.model, "refactor", parsed);
    }
  };
  return (
    <PanelShell
      loading={loading}
      error={error}
      actions={<Button onClick={run} className="gap-2"><Wrench className="h-4 w-4" /> Improve this repository</Button>}
      empty={<p className="text-sm text-muted-foreground">AI suggests folder restructuring, duplicated code, naming, and performance wins.</p>}
    >
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <RefactorGroup title="Restructure" items={data.restructure?.map((r) => ({ h: `${r.from} → ${r.to}`, b: r.why })) ?? []} />
          <RefactorGroup title="Duplication" items={data.duplication?.map((d) => ({ h: d.where, b: d.note })) ?? []} />
          <RefactorGroup title="Naming" items={data.naming?.map((n) => ({ h: n.file, b: n.suggestion })) ?? []} />
          <RefactorGroup title="Performance" items={data.performance?.map((p) => ({ h: p.where, b: p.suggestion })) ?? []} />
        </div>
      )}
    </PanelShell>
  );
}

function RefactorGroup({ title, items }: { title: string; items: { h: string; b: string }[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="text-xs font-mono-tight uppercase tracking-widest text-amber">{title}</div>
      <ul className="mt-2 space-y-2">
        {items.length === 0 && <li className="text-sm text-muted-foreground">Nothing notable.</li>}
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            <div className="font-mono-tight text-foreground">{it.h}</div>
            <div className="text-muted-foreground">{it.b}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocsPanel({ provider, repoContext, repoName }: { provider: ProviderState; repoContext: string; repoName?: string }) {
  const [kind, setKind] = useState<"readme" | "contributing" | "api" | "onboarding">("readme");
  const [text, setText] = useState<string | null>(null);
  const { loading, error, call } = useTaskCall(provider);
  const run = async () => {
    const res = await call({ ...baseArgs(provider, repoContext), kind: "docs", docKind: kind }, { repo: repoName });
    setText(res.text);
  };
  const kinds: { id: typeof kind; label: string }[] = [
    { id: "readme", label: "README" },
    { id: "contributing", label: "CONTRIBUTING" },
    { id: "api", label: "API docs" },
    { id: "onboarding", label: "Onboarding" },
  ];
  return (
    <PanelShell
      loading={loading}
      error={error}
      actions={
        <>
          <div className="flex gap-1 rounded-md border border-border/60 bg-background/40 p-0.5">
            {kinds.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`rounded px-2.5 py-1 text-xs font-mono-tight ${
                  kind === k.id ? "bg-amber/20 text-amber" : "text-muted-foreground"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Button onClick={run} className="gap-2 ml-auto">
            <FileText className="h-4 w-4" /> Generate
          </Button>
          {text && (
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(text)}
            >
              Copy
            </Button>
          )}
        </>
      }
      empty={<p className="text-sm text-muted-foreground">Generate README, CONTRIBUTING, API docs, or an onboarding guide.</p>}
    >
      {text && (
        <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background/40 p-4 font-mono-tight text-sm text-foreground/90">
          {text}
        </pre>
      )}
    </PanelShell>
  );
}

function LearningPanel({ provider, repoContext, repoName }: { provider: ProviderState; repoContext: string; repoName?: string }) {
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [text, setText] = useState<string | null>(null);
  const { loading, error, call } = useTaskCall(provider);
  const run = async () => {
    const res = await call({ ...baseArgs(provider, repoContext), kind: "learning", learningLevel: level }, { repo: repoName });
    setText(res.text);
  };
  return (
    <PanelShell
      loading={loading}
      error={error}
      actions={
        <>
          <div className="flex gap-1 rounded-md border border-border/60 bg-background/40 p-0.5">
            {(["beginner", "intermediate", "advanced"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`rounded px-2.5 py-1 text-xs font-mono-tight capitalize ${
                  level === l ? "bg-amber/20 text-amber" : "text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Button onClick={run} className="gap-2 ml-auto">
            <GraduationCap className="h-4 w-4" /> Teach me
          </Button>
        </>
      }
      empty={<p className="text-sm text-muted-foreground">Sherlock adapts explanations to your level.</p>}
    >
      {text && (
        <div className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background/40 p-4 text-sm leading-relaxed text-foreground/90">
          {text}
        </div>
      )}
    </PanelShell>
  );
}

function RoadmapPanel({
  provider,
  repoContext,
  repoUrl,
  repoName,
}: {
  provider: ProviderState;
  repoContext: string;
  repoUrl: string;
  repoName?: string;
}) {
  const [items, setItems] = useState<
    | null
    | {
        title: string;
        priority: "P0" | "P1" | "P2";
        effort: "S" | "M" | "L";
        businessValue: string;
        why: string;
      }[]
  >(() => getCachedTask(repoUrl, provider.model, "roadmap"));
  const { loading, error, call } = useTaskCall(provider);
  const run = async () => {
    const res = await call({ ...baseArgs(provider, repoContext), kind: "roadmap" }, { repo: repoName });
    if (res.jsonString) {
      const parsed = JSON.parse(res.jsonString) as { items?: typeof items };
      const next = parsed.items ?? [];
      setItems(next);
      saveTask(repoUrl, provider.model, "roadmap", next);
    }
  };
  const pColor = (p: string) =>
    p === "P0" ? "text-crimson border-crimson/40" : p === "P1" ? "text-amber border-amber/40" : "text-emerald border-emerald/40";
  return (
    <PanelShell
      loading={loading}
      error={error}
      actions={<Button onClick={run} className="gap-2"><Rocket className="h-4 w-4" /> Suggest roadmap</Button>}
      empty={<p className="text-sm text-muted-foreground">AI proposes priorities, effort, and business value.</p>}
    >
      {items && (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono-tight ${pColor(it.priority)}`}>
                  {it.priority}
                </span>
                <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-mono-tight text-muted-foreground">
                  effort {it.effort}
                </span>
                <span className="font-medium text-foreground">{it.title}</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{it.why}</div>
              <div className="mt-1 text-xs text-emerald">Value: {it.businessValue}</div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
function AuditPanel() {
  const [entries, setEntries] = useState(() => listAudit());
  const refresh = () => setEntries(listAudit());
  return (
    <PanelShell
      actions={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono-tight uppercase tracking-widest text-amber">Audit Trail</div>
            <p className="text-xs text-muted-foreground">Workspace-scoped activity log — exportable for compliance.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadAudit("csv")} aria-label="Export audit trail as CSV">
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadAudit("json")} aria-label="Export audit trail as JSON">
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { clearAudit(); refresh(); }} aria-label="Clear audit trail">
              Clear
            </Button>
          </div>
        </div>
      }
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/50">
          <table className="w-full text-xs">
            <caption className="sr-only">Audit trail entries</caption>
            <thead className="bg-background/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Time</th>
                <th scope="col" className="px-3 py-2">Kind</th>
                <th scope="col" className="px-3 py-2">Repo</th>
                <th scope="col" className="px-3 py-2">Model</th>
                <th scope="col" className="px-3 py-2">Latency</th>
                <th scope="col" className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono-tight">
              {entries.slice(0, 100).map((e) => (
                <tr key={e.id} className="border-t border-border/40">
                  <td className="px-3 py-1.5 text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</td>
                  <td className="px-3 py-1.5">{e.kind}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.repo ?? "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.model ?? "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.latencyMs ? `${e.latencyMs}ms` : "—"}</td>
                  <td className={`px-3 py-1.5 ${e.ok ? "text-emerald" : "text-crimson"}`}>{e.ok ? "ok" : "fail"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}
