// Client-side PDF report generation from an AnalysisResult.
// Uses the site's visual language (ivory canvas, ink text, amber accent).
// No AI call — just structured formatting of what we already have.
import { jsPDF } from "jspdf";
import type { AnalysisResult } from "./analyze.functions";

const COLOR = {
  ink: [24, 22, 20] as [number, number, number],
  muted: [110, 105, 100] as [number, number, number],
  amber: [190, 120, 30] as [number, number, number],
  emerald: [40, 120, 90] as [number, number, number],
  crimson: [175, 55, 55] as [number, number, number],
  hair: [220, 214, 205] as [number, number, number],
  paper: [250, 246, 238] as [number, number, number],
};

function verdictColor(v: string): [number, number, number] {
  if (v === "good") return COLOR.emerald;
  if (v === "warn") return COLOR.amber;
  return COLOR.crimson;
}

function severityColor(s: string): [number, number, number] {
  if (s === "critical") return COLOR.crimson;
  if (s === "warning") return COLOR.amber;
  return COLOR.emerald;
}

export function downloadAnalysisPdf(a: AnalysisResult) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const setC = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setF = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setD = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      addFooter();
      doc.addPage();
      paintPaper();
      y = margin;
    }
  };

  const paintPaper = () => {
    setF(COLOR.paper);
    doc.rect(0, 0, pageW, pageH, "F");
  };

  let pageNum = 0;
  const addFooter = () => {
    pageNum++;
    setC(COLOR.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("CodeSherlock — Repository Intelligence Report", margin, pageH - 24);
    doc.text(String(pageNum), pageW - margin, pageH - 24, { align: "right" });
    setD(COLOR.hair);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 34, pageW - margin, pageH - 34);
  };

  const heading = (label: string) => {
    ensure(28);
    setC(COLOR.amber);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), margin, y);
    setD(COLOR.amber);
    doc.setLineWidth(0.75);
    doc.line(margin, y + 4, margin + 40, y + 4);
    y += 18;
  };

  const body = (text: string, size = 10, color: [number, number, number] = COLOR.ink) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setC(color);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  const bullet = (label: string, value: string, color: [number, number, number] = COLOR.ink) => {
    ensure(16);
    setF(color);
    doc.circle(margin + 3, y - 3, 2, "F");
    setC(COLOR.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, margin + 12, y);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    setC(COLOR.muted);
    const lines = doc.splitTextToSize(value, contentW - labelW - 20) as string[];
    doc.text(lines[0] ?? "", margin + 16 + labelW, y);
    y += 14;
    for (let i = 1; i < lines.length; i++) {
      ensure(14);
      doc.text(lines[i], margin + 16 + labelW, y);
      y += 14;
    }
  };

  // ---------- Page 1: Cover ----------
  paintPaper();

  // brand
  setF(COLOR.ink);
  doc.roundedRect(margin, y, 26, 26, 4, 4, "F");
  setC(COLOR.paper);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("S", margin + 8, y + 19);
  setC(COLOR.ink);
  doc.setFontSize(11);
  doc.text("CodeSherlock", margin + 36, y + 12);
  setC(COLOR.muted);
  doc.setFontSize(8);
  doc.text("REPOSITORY INTELLIGENCE REPORT", margin + 36, y + 24);
  y += 60;

  // case number
  setC(COLOR.amber);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `CASE FILE #${a.meta.fullName.length.toString().padStart(4, "0")}`,
    margin,
    y,
  );
  y += 20;

  // title
  setC(COLOR.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(a.meta.fullName, contentW) as string[];
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 30;
  }

  if (a.meta.description) {
    y += 4;
    body(a.meta.description, 11, COLOR.muted);
  }

  y += 8;
  // stats row
  setC(COLOR.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const stats = [
    `★ ${a.meta.stars.toLocaleString()}`,
    `⑂ ${a.meta.forks.toLocaleString()}`,
    `${a.stats.fileCount}${a.stats.truncated ? "+" : ""} files`,
    `${a.meta.language ?? "—"}`,
    `${a.meta.license ?? "no license"}`,
  ].join("   ·   ");
  doc.text(stats, margin, y);
  y += 24;

  // Health box
  ensure(120);
  setD(COLOR.hair);
  doc.setLineWidth(0.75);
  doc.roundedRect(margin, y, contentW, 110, 6, 6, "S");

  const scoreC =
    a.healthScore >= 80 ? COLOR.emerald : a.healthScore >= 60 ? COLOR.amber : COLOR.crimson;
  setC(scoreC);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(56);
  doc.text(String(a.healthScore), margin + 20, y + 70);
  setC(COLOR.muted);
  doc.setFontSize(10);
  doc.text("/ 100", margin + 20 + doc.getTextWidth(String(a.healthScore)) + 6, y + 70);
  setC(COLOR.ink);
  doc.setFontSize(10);
  doc.text("HEALTH SCORE", margin + 20, y + 24);
  setC(COLOR.muted);
  doc.setFontSize(9);
  const labels = ["low ‹ 60", "medium 60–79", "healthy ≥ 80"];
  doc.text(labels.join("   "), margin + 20, y + 90);

  // right side: 5 lines of breakdown
  const rx = margin + contentW / 2 + 8;
  let ry = y + 20;
  for (const h of a.healthBreakdown.slice(0, 5)) {
    setF(verdictColor(h.verdict));
    doc.circle(rx + 3, ry - 3, 2.5, "F");
    setC(COLOR.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(h.label, rx + 12, ry);
    setC(COLOR.muted);
    doc.setFont("helvetica", "normal");
    const note = doc.splitTextToSize(h.note, contentW / 2 - 30) as string[];
    doc.text(note[0] ?? "", rx + 12, ry + 10);
    ry += 20;
  }
  y += 128;

  // ---------- Executive summary ----------
  heading("Executive Summary");
  body(a.overview);
  y += 6;
  bullet("Built for:", a.audience);
  bullet("Complexity:", a.complexity);
  bullet("Learning curve:", a.learningCurve);
  y += 10;

  // ---------- Technologies ----------
  if (a.technologies.length) {
    heading("Technology Stack");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let cx = margin;
    const cy0 = y;
    let cy = cy0;
    for (const t of a.technologies) {
      const w = doc.getTextWidth(t) + 14;
      if (cx + w > margin + contentW) {
        cx = margin;
        cy += 20;
      }
      ensure(20);
      setD(COLOR.amber);
      setC(COLOR.amber);
      doc.setLineWidth(0.5);
      doc.roundedRect(cx, cy - 10, w, 16, 8, 8, "S");
      doc.text(t, cx + 7, cy);
      cx += w + 6;
    }
    y = cy + 16;
  }

  // ---------- Architecture ----------
  if (a.architecture.length) {
    heading("Architecture");
    for (const node of a.architecture) {
      ensure(50);
      setC(COLOR.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${node.label}  ·  ${node.kind}`, margin, y);
      y += 14;
      body(node.explanation, 10, COLOR.muted);
      if (node.files?.length) {
        setC(COLOR.amber);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const files = node.files.slice(0, 8).join("  ·  ");
        const lines = doc.splitTextToSize(files, contentW) as string[];
        for (const line of lines) {
          ensure(12);
          doc.text(line, margin, y);
          y += 11;
        }
      }
      y += 8;
    }
  }

  // ---------- Folder Explorer ----------
  if (a.folders.length) {
    heading("Folder Explorer");
    for (const f of a.folders) {
      ensure(30);
      setC(COLOR.amber);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(f.path, margin, y);
      setC(COLOR.muted);
      doc.setFont("helvetica", "normal");
      doc.text(`${f.confidence}%`, margin + contentW, y, { align: "right" });
      y += 12;
      body(f.summary, 10, COLOR.ink);
      body(f.role, 9, COLOR.muted);
      y += 4;
    }
  }

  // ---------- Entry points ----------
  if (a.entryPoints.length) {
    heading("Read These First");
    body(a.entryPoints.map((e) => `• ${e}`).join("   "), 10, COLOR.ink);
  }

  // ---------- Risks ----------
  if (a.risks.length) {
    heading("Risks & Findings");
    for (const r of a.risks) {
      ensure(40);
      setF(severityColor(r.severity));
      doc.circle(margin + 3, y - 3, 2.5, "F");
      setC(COLOR.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${r.title}`, margin + 12, y);
      setC(COLOR.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(r.severity.toUpperCase(), margin + contentW, y, { align: "right" });
      y += 12;
      const lines = doc.splitTextToSize(r.note, contentW - 12) as string[];
      for (const line of lines) {
        ensure(12);
        doc.text(line, margin + 12, y);
        y += 11;
      }
      y += 6;
    }
  }

  // ---------- Suggested questions ----------
  if (a.suggestedQuestions.length) {
    heading("Suggested Questions");
    for (const q of a.suggestedQuestions) {
      ensure(14);
      setC(COLOR.ink);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(`“${q}”`, contentW) as string[];
      for (const line of lines) {
        ensure(14);
        doc.text(line, margin, y);
        y += 13;
      }
      y += 4;
    }
  }

  addFooter();

  const safe = a.meta.fullName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`codesherlock-${safe}.pdf`);
}