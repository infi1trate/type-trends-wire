import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, READ } from "./shared";
import { BRAND_NAME } from "../../brand";

export const COLLECTION_TILES = 12;
export default defineTool({ name: "collections", title: "Collections", description: `${BRAND_NAME} collections: numbered, saved views of the pattern gallery (walls of stored homepage captures). Without slug: the list with status and capture counts. With slug: title, deck, the saved filter, the count and the first ${COLLECTION_TILES} tiles as text with urls.`,
  inputSchema: { slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional().describe("A collection slug from the list, e.g. who-went-big.") },
  annotations: READ,
  handler: async ({ slug }) => {
    const [{ loadCollections, loadCollection }, { collectionOf }, { SITE_URL }] = await Promise.all([import("@/lib/gallery.server"), import("@/lib/collections/registry"), import("@/lib/site")]);
    const abs = (h: string) => (h.startsWith("/") ? `${SITE_URL}${h}` : h);
    const receipts = { source: `${BRAND_NAME} library captures (crops when stored, otherwise layouts redrawn from stored skeletons); a collection is live at 12 or more matching captures`, method: "trend://methodology" };
    if (!slug) {
      const rows = await loadCollections();
      return json({ collections: rows.map(c => ({ number: c.number, slug: c.slug, title: c.title, deck: c.deck, status: c.status, draft_reason: c.reason, count: c.count, pairs_with: { label: c.pairs.label, url: abs(c.pairs.href) }, url: abs(`/collections/${c.slug}`) })), receipts });
    }
    const c = await loadCollection(slug);
    if (c.kind === "missing") throw new ToolError(`No collection "${slug}". Call collections without a slug for the list.`);
    const filter = collectionOf(slug)?.filter ?? {};
    const base = { number: c.number, slug, title: c.title, deck: c.deck, filter, pairs_with: { label: c.pairs.label, url: abs(c.pairs.href) }, url: abs(`/collections/${slug}`) };
    if (c.kind === "draft") return json({ ...base, status: "draft", draft_reason: c.reason, count: c.count, receipts });
    return json({ ...base, status: "live", count: c.gallery.total,
      tiles: c.gallery.tiles.slice(0, COLLECTION_TILES).map(t => ({ text: t.label + (t.note ? ` (${t.note})` : ""), domain: t.domain, captured: t.day, source: t.source, picture: t.crop ? "crop" : "redrawn from stored layout", url: abs(t.href) })), receipts });
  } });
