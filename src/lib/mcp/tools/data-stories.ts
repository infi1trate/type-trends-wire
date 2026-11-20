import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, READ } from "./shared";
import { BRAND_NAME } from "../../brand";

export default defineTool({ name: "data_stories", title: "Studies", description: `${BRAND_NAME} studies: each one argument about how brands look on the web, with its evidence from stored captures, in a standing series. Without slug: the numbered list (Study No. N) with series and status. With slug: the written headline, deck, opening and scenes, every step as text with its figures and receipts, the limits and what the numbers are based on.`,
  inputSchema: { slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional().describe("A study slug from the list, e.g. who-went-big-first.") },
  annotations: READ,
  handler: async ({ slug }) => {
    const [{ loadDataIndex, loadDataStory }, { SITE_URL }, { capText, isNum }] = await Promise.all([import("@/lib/data-stories/page.server"), import("@/lib/site"), import("@/lib/data-stories/text")]);
    const abs = (h: string) => (h.startsWith("/") ? `${SITE_URL}${h}` : h);
    if (!slug) {
      const { rows, home } = await loadDataIndex(), written = new Map((home?.series ?? []).flatMap(s => s.studies).map(s => [s.slug, s.headline]));
      return json({ stories: rows.map(r => ({ number: r.number, label: `Study No. ${r.number}`, slug: r.slug, series: r.series, question: r.question, headline: written.get(r.slug) ?? null, deck: r.deck, template: r.template, status: r.status, draft_reason: r.reason, data_through: r.dataThrough, url: r.href ? abs(r.href) : null })),
        receipts: { source: `${BRAND_NAME} studies registry (each live study passed its "is there a story" check on stored data)`, method: "trend://methodology" } });
    }
    const p = await loadDataStory(slug);
    if (p.kind === "missing") throw new ToolError(`No study "${slug}". Call data_stories without a slug for the list.`);
    if (p.kind === "draft") return json({ number: p.number, slug, question: p.question, status: "draft", draft_reason: p.reason });
    const s = p.story;
    return json({
      number: s.number, label: `Study No. ${s.number}`, series: s.seriesTitle, slug: s.slug, headline: s.text.headline, question: s.question, deck: s.text.deck, template: s.template, status: "live", data_through: s.dataThrough, key_figure: s.key,
      text: { source: s.text.source, opening: s.text.opening, scenes: s.text.scenes, use: s.text.use ?? null, from: s.text.stale ? s.text.at : null }, limits: s.limits,
      steps: s.steps.map((st, k) => ({ step: k + 1, text: capText(st.caption), figures: st.caption.filter(isNum).map(n => ({ text: n.n, value: n.v, receipt: abs(n.href) })), url: `${SITE_URL}/data/${s.slug}?step=${k + 1}` })),
      basis: s.basis, collection: { ...s.collection, href: abs(s.collection.href) }, related: s.related.map(r => ({ ...r, href: abs(r.href) })),
      urls: { page: `${SITE_URL}/data/${s.slug}`, image: `${SITE_URL}/data/${s.slug}.png`, embed: `${SITE_URL}/data/embed/${s.slug}?step=1` },
      receipts: { source: `${BRAND_NAME} library captures and archive history; the written text is checked against the study's facts sheet (every number, name and date on the sheet); steps are templates filled from numbers`, method: "trend://methodology" },
    });
  } });
