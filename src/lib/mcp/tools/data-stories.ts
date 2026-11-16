import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, READ } from "./shared";
import { BRAND_NAME } from "../../brand";

export default defineTool({ name: "data_stories", title: "Data stories", description: `${BRAND_NAME} data stories: one question about how brands look on the web, answered step by step from stored captures. Without slug: the numbered list with status. With slug: the question, every step as text with its figures and receipts, and what the numbers are based on.`,
  inputSchema: { slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional().describe("A data story slug from the list, e.g. who-went-big-first.") },
  annotations: READ,
  handler: async ({ slug }) => {
    const [{ loadDataIndex, loadDataStory }, { SITE_URL }, { capText, isNum }] = await Promise.all([import("@/lib/data-stories/page.server"), import("@/lib/site"), import("@/lib/data-stories/text")]);
    const abs = (h: string) => (h.startsWith("/") ? `${SITE_URL}${h}` : h);
    if (!slug) {
      const { rows } = await loadDataIndex();
      return json({ stories: rows.map(r => ({ number: r.number, slug: r.slug, question: r.question, deck: r.deck, template: r.template, status: r.status, draft_reason: r.reason, data_through: r.dataThrough, url: r.href ? abs(r.href) : null })),
        receipts: { source: `${BRAND_NAME} data stories registry (each live story passed its "is there a story" check on stored data)`, method: "trend://methodology" } });
    }
    const p = await loadDataStory(slug);
    if (p.kind === "missing") throw new ToolError(`No data story "${slug}". Call data_stories without a slug for the list.`);
    if (p.kind === "draft") return json({ number: p.number, slug, question: p.question, status: "draft", draft_reason: p.reason });
    const s = p.story;
    return json({
      number: s.number, slug: s.slug, question: s.question, deck: s.deck, template: s.template, status: "live", data_through: s.dataThrough, key_figure: s.key,
      steps: s.steps.map((st, k) => ({ step: k + 1, text: capText(st.caption), figures: st.caption.filter(isNum).map(n => ({ text: n.n, value: n.v, receipt: abs(n.href) })), url: `${SITE_URL}/data/${s.slug}?step=${k + 1}` })),
      basis: s.basis, collection: { ...s.collection, href: abs(s.collection.href) }, related: s.related.map(r => ({ ...r, href: abs(r.href) })),
      urls: { page: `${SITE_URL}/data/${s.slug}`, image: `${SITE_URL}/data/${s.slug}.png`, embed: `${SITE_URL}/data/embed/${s.slug}?step=1` },
      receipts: { source: `${BRAND_NAME} library captures and archive history; every sentence is a template filled from numbers (no AI-written text)`, method: "trend://methodology" },
    });
  } });
