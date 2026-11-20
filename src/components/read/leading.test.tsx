// W2 · /signals/leading: the empty first day, a populated table, the phone layout and the Data view's CSV and expand.
import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", async orig => ({ ...(await orig<typeof import("@tanstack/react-router")>()), Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a> }));
import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { allTables, indicatorTables, type SeriesRow } from "@/lib/indicators/series";
import { LeadingData, LeadingRead, lastReadLine, NOT_STARTED_LINE, sortRows } from "./LeadingView";
import { toggleHref } from "@/lib/ia";

const client = (body: unknown) => { const q = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); q.setQueryData(["indicators"], body); return q; };
const wrap = (q: QueryClient, el: React.ReactNode) => <QueryClientProvider client={q}>{el}</QueryClientProvider>;
const EMPTY = { lastRead: null, began: null, tables: allTables([]), fonts: { mode: "none" }, empty: true };
const weeks = (label: string, key: string, values: number[], topic = "motion"): SeriesRow[] => values.map((v, i) => ({ source: "npm", key, metric: "downloads_week", label, topic, value: v,
  period_end: new Date(Date.parse("2026-10-21T00:00:00Z") + i * 7 * 864e5).toISOString().slice(0, 10) }));
const FULL = { lastRead: "2026-11-20T05:37:00Z", began: "2026-10-21", fonts: { mode: "top", now: "2026-11-20", since: "2026-11-10", items: [{ family: "Inter", now: 1 }] }, empty: false,
  tables: allTables(indicatorTables([...weeks("Motion", "motion", [100, 110, 120, 130, 150]), ...weeks("GSAP", "gsap", [900, 950]),
    { source: "github", key: "motiondivision/motion", metric: "stars", label: "Motion", topic: "motion", value: 28000, period_end: "2026-11-18" }])) };

describe("/signals/leading", () => {
  it("before any rows: every topic table is present and the head line says collection starts on the next daily run", () => {
    const html = renderToStaticMarkup(wrap(client(EMPTY), <LeadingRead />));
    expect(lastReadLine(null)).toBe(NOT_STARTED_LINE);
    expect(NOT_STARTED_LINE).toBe("Collection starts on the next daily run.");
    for (const t of ["type", "styling", "components", "motion", "3d", "icons", "charts", "carousels", "tokens"]) expect(html).toContain(`id="lead-${t}"`);
    expect(html.indexOf('id="lead-type"')).toBeLessThan(html.indexOf('id="lead-styling"'));
    expect(html).toContain("How to read these numbers");
  });
  it("rows sort by installs; change and small line appear only when the data supports them; exact values in titles", () => {
    const html = renderToStaticMarkup(wrap(client(FULL), <LeadingRead />));
    expect(html.indexOf(`data-row="GSAP"`)).toBeLessThan(html.indexOf(`data-row="Motion"`));
    expect(html).toContain("+50%");
    expect(html).toContain('title="150 npm installs in the week');
    expect(html).toContain("weekly installs, 5 weeks");
    expect(html).toContain('href="https://www.npmjs.com/package/gsap"');
    expect(html).toContain('href="https://github.com/motiondivision/motion"');
    expect(html).toContain("Needs two weekly counts at least 21 days apart");
  });
  it("on a phone the stars and small line sit under the name", () => {
    const html = renderToStaticMarkup(wrap(client(FULL), <LeadingRead />));
    expect(html).toMatch(/class="ed-caption sm:hidden">Stars/);
    expect(html).toMatch(/max-sm:hidden">GitHub stars/);
  });
  it("Data view: sortable, exact values, a row expands to its raw points", () => {
    const q = client(FULL); q.setQueryData(["indicator-points", "Motion"], [{ source: "npm", key: "motion", metric: "downloads_week", period_end: "2026-10-21", value: 100 }]);
    const { container } = render(wrap(q, <LeadingData />));
    expect(container.querySelector('[aria-sort="descending"]')?.textContent).toContain("Installs");
    fireEvent.click(container.querySelector('tr[data-row="Motion"] button[aria-expanded]')!);
    expect(container.textContent).toContain("2026-10-21");
    expect(sortRows(FULL.tables.flatMap(t => t.rows), "label", false).map(r => r.label)).toEqual(["GSAP", "Motion"]);
    cleanup();
  });
  it("the Read/Terminal switch stays on the same address", () => {
    expect(toggleHref("/signals/leading", {})).toBe("/signals/leading?view=data");
    expect(toggleHref("/signals/leading", { view: "data" })).toBe("/signals/leading");
  });
});
