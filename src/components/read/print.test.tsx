import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { footnotes } from "./PrintFrame";

const css = readFileSync("src/styles.css", "utf8");
const printBlocks = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map(m => m[1]!).join("\n");
const src = (p: string) => readFileSync(p, "utf8");

describe("print rules", () => {
  it("one sheet setup works for A4 and Letter, in paper, ink and green", () => {
    expect(printBlocks).toMatch(/@page \{ size: auto;/);
    expect(printBlocks).toMatch(/background: var\(--tk-print-paper\)/);
    expect(printBlocks).toMatch(/color: var\(--tk-print-ink\) !important/);
    expect(printBlocks).toMatch(/\[data-stage\][^{]*\{ color: var\(--sys-color-positive\)/);
  });
  it("no chrome, controls or ticker; the mark on top and the address and date on every sheet", () => {
    for (const sel of [".shell-top", "[data-shell-row]", ".ed-nav", ".front-ticker", "button", "form", ".c-raised", ".ed-footer"]) expect(printBlocks, sel).toContain(sel);
    expect(printBlocks).toMatch(/\.print-foot \{ position: fixed; bottom: 0;/);
    expect(printBlocks).toMatch(/\.print-only \{ display: block !important; \}/);
    const shell = src("src/components/read/ReadShell.tsx");
    expect(shell.indexOf("<PrintMark />")).toBeLessThan(shell.indexOf('<main id="ed-main"'));
    expect(shell.indexOf("<PrintFrame path=")).toBeGreaterThan(shell.indexOf('<main id="ed-main"'));
  });
  it("headings stay with what follows; Ledger rows, figures, cards and data-story steps never split", () => {
    expect(printBlocks).toMatch(/:is\(h1, h2, h3, h4.*\) \{ break-after: avoid;/);
    for (const sel of [".ledger-row", "figure", "tr", "[data-step]", '[data-container="card"]']) expect(printBlocks, sel).toContain(sel);
    expect(printBlocks).toMatch(/\.tk-chart, tr, \[data-step\][^{]*\{ break-inside: avoid;/);
  });
  it("each Read page type prints through the shared shell", () => {
    const views: Record<string, string> = { story: "src/components/read/StoryView.tsx", signal: "src/components/read/SignalView.tsx", brand: "src/components/read/BrandView.tsx",
      digest: "src/components/digest/IssueView.tsx", sector: "src/components/read/EditionsViews.tsx", data: "src/components/data/DataStoryView.tsx", audit: "src/components/agency/AuditView.tsx" };
    for (const [k, p] of Object.entries(views)) expect(src(p), k).toMatch(/DigestShell|AgencyShell|ReadShell/);
    expect(src("src/components/agency/Shell.tsx")).toContain("<ReadShell");
    expect(src("src/components/digest/Editorial.tsx")).toContain("<ReadShell");
  });
  it("stories, signals and audit reports print each address once as a footnote", () => {
    for (const r of ["src/routes/stories.$id.tsx", "src/routes/signals.$key.tsx", "src/routes/audit.index.tsx"]) expect(src(r), r).toContain('data-receipts=""');
    expect(printBlocks).toMatch(/\[data-receipts\] \.digest a\[data-fn\]::after \{ content: "\[" attr\(data-fn\) "\]"/);
    const f = footnotes(["https://a", "https://b", "https://a", "https://c"]);
    expect(f.numbers).toEqual([1, 2, 1, 3]);
    expect(f.notes).toEqual([{ n: 1, href: "https://a" }, { n: 2, href: "https://b" }, { n: 3, href: "https://c" }]);
  });
  it("a data story prints every step, one block each", () => {
    expect(src("src/components/data/DataStoryView.tsx")).toMatch(/StepSequence[^>]*full=\{printing \|\| allFigures\}/);
  });
});
