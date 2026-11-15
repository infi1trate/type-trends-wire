// Watchlists: capability-link tokens, validation and edit rules. Pure (no I/O); the server layer injects lookups.
import { z } from "zod";
import { DOMAIN_RE } from "../thumbs";
import { SECTORS } from "../library";
import { canonical } from "../labels";

export const WATCH_LIMITS = { name: 80, sites: 25, traits: 25, sectors: 10, editsPerHour: 20 } as const;
export const WATCH_WINDOW_MS = 60 * 60 * 1000;
/** 16 random bytes → 22 base64url chars (128 bits). Used for the view id, the edit token and the feed token. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
export const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export type RandomBytes = (n: number) => Uint8Array;
export const cryptoBytes: RandomBytes = n => crypto.getRandomValues(new Uint8Array(n));
export const newToken = (rand: RandomBytes = cryptoBytes) => b64url(rand(16));

/** "https://www.Linear.app/pricing" → "linear.app"; null when it isn't a domain. */
export function normDomain(raw: string): string | null {
  let t = raw.trim().toLowerCase();
  if (!t) return null;
  t = t.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0]!.replace(/:\d+$/, "").replace(/\.$/, "");
  return DOMAIN_RE.test(t) ? t : null;
}
export const TRAIT_RE = /^[a-z0-9_]+:[^\s,]{1,80}$/i;
export const isTraitInput = (t: string) => TRAIT_RE.test(t.trim()) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(t.trim());
export const uniqSorted = (xs: string[]) => [...new Set(xs)].sort();
/** Split "a.com, b.com c.com" into tokens. */
export const splitTargets = (raw: string) => raw.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);

export type WatchState = { name: string; sites: string[]; pending_sites: string[]; traits: string[]; sectors: string[] };
export type Ctx = { active: Set<string>; traits: Set<string> };
export type Classified = { sites: string[]; untracked: string[]; invalid: string[]; traits: string[]; unknownTraits: string[] };

/** Sort raw inputs into active library sites, valid-but-untracked domains, invalid strings, forecast traits and unknown traits. */
export function classify(inputs: { sites?: string[] | undefined; traits?: string[] | undefined }, ctx: Ctx): Classified {
  const out: Classified = { sites: [], untracked: [], invalid: [], traits: [], unknownTraits: [] };
  for (const raw of inputs.sites ?? []) {
    if (isTraitInput(raw)) { (ctx.traits.has(canonical(raw)) ? out.traits : out.unknownTraits).push(ctx.traits.has(canonical(raw)) ? canonical(raw) : raw); continue; }
    const d = normDomain(raw);
    if (!d) out.invalid.push(raw); else (ctx.active.has(d) ? out.sites : out.untracked).push(d);
  }
  for (const raw of inputs.traits ?? []) { const k = canonical(raw.trim()); if (ctx.traits.has(k)) out.traits.push(k); else out.unknownTraits.push(raw); }
  return { sites: uniqSorted(out.sites), untracked: uniqSorted(out.untracked), invalid: [...new Set(out.invalid)], traits: uniqSorted(out.traits), unknownTraits: [...new Set(out.unknownTraits)] };
}

/** Pending (render-requested) domains become sites once they are active library domains. */
export function promote(w: WatchState, active: Set<string>): WatchState {
  const moved = w.pending_sites.filter(d => active.has(d));
  return moved.length ? { ...w, sites: uniqSorted([...w.sites, ...moved]), pending_sites: w.pending_sites.filter(d => !active.has(d)) } : w;
}

export const sectorList = (xs: string[] | undefined) => uniqSorted((xs ?? []).map(x => x.trim().toLowerCase()).filter(x => (SECTORS as readonly string[]).includes(x)));
export const cleanName = (raw: string) => raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, WATCH_LIMITS.name);

export type EditError = "limit" | "empty_name" | "nothing_valid";
export type Op =
  | { op: "rename"; name: string }
  | { op: "add"; sites?: string[] | undefined; traits?: string[] | undefined; request_render?: boolean | undefined }
  | { op: "remove"; sites?: string[] | undefined; traits?: string[] | undefined }
  | { op: "sectors"; sectors: string[] }
  | { op: "rotate_feed" }
  | { op: "delete" };
export const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("rename"), name: z.string().min(1).max(200) }).strict(),
  z.object({ op: z.literal("add"), sites: z.array(z.string().max(300)).max(50).optional(), traits: z.array(z.string().max(120)).max(50).optional(), request_render: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("remove"), sites: z.array(z.string().max(300)).max(50).optional(), traits: z.array(z.string().max(120)).max(50).optional() }).strict(),
  z.object({ op: z.literal("sectors"), sectors: z.array(z.string().max(40)).max(20) }).strict(),
  z.object({ op: z.literal("rotate_feed") }).strict(),
  z.object({ op: z.literal("delete") }).strict(),
]);
export const createSchema = z.object({
  name: z.string().min(1).max(200),
  sites: z.array(z.string().max(300)).max(50).default([]),
  traits: z.array(z.string().max(120)).max(50).default([]),
  sectors: z.array(z.string().max(40)).max(20).optional(),
  request_render: z.boolean().optional(),
}).strict();

export type EditResult = { state: WatchState; classified: Classified | null; error: EditError | null; queued: string[] };
const withinLimits = (w: WatchState) => w.sites.length + w.pending_sites.length <= WATCH_LIMITS.sites && w.traits.length <= WATCH_LIMITS.traits && w.sectors.length <= WATCH_LIMITS.sectors;

/** Apply one edit. Untracked domains join `pending_sites` (and are queued) only when a render was requested. Over-limit edits are refused whole. */
export function applyOp(current: WatchState, op: Op, ctx: Ctx): EditResult {
  const base = promote(current, ctx.active);
  if (op.op === "rename") { const name = cleanName(op.name); return name ? { state: { ...base, name }, classified: null, error: null, queued: [] } : { state: base, classified: null, error: "empty_name", queued: [] }; }
  if (op.op === "sectors") return { state: { ...base, sectors: sectorList(op.sectors) }, classified: null, error: null, queued: [] };
  if (op.op === "rotate_feed" || op.op === "delete") return { state: base, classified: null, error: null, queued: [] };
  if (op.op === "remove") {
    const drop = new Set([...(op.sites ?? []).map(x => (isTraitInput(x) ? canonical(x) : normDomain(x) ?? x)), ...(op.traits ?? []).map(x => canonical(x.trim()))]);
    return { state: { ...base, sites: base.sites.filter(d => !drop.has(d)), pending_sites: base.pending_sites.filter(d => !drop.has(d)), traits: base.traits.filter(t => !drop.has(t)) }, classified: null, error: null, queued: [] };
  }
  const c = classify(op, ctx), queued = op.request_render ? c.untracked.filter(d => !base.pending_sites.includes(d)) : [];
  const next: WatchState = { ...base, sites: uniqSorted([...base.sites, ...c.sites]), pending_sites: uniqSorted([...base.pending_sites, ...queued]), traits: uniqSorted([...base.traits, ...c.traits]) };
  if (!withinLimits(next)) return { state: base, classified: c, error: "limit", queued: [] };
  if (!c.sites.length && !c.traits.length && !queued.length) return { state: base, classified: c, error: "nothing_valid", queued: [] };
  return { state: next, classified: c, error: null, queued };
}

/** Initial state for a new watchlist (same rules as `add`, but an empty list is allowed). */
export function initialState(input: { name: string; sites: string[]; traits: string[]; sectors?: string[] | undefined; request_render?: boolean | undefined }, ctx: Ctx): EditResult {
  const name = cleanName(input.name);
  const empty: WatchState = { name, sites: [], pending_sites: [], traits: [], sectors: sectorList(input.sectors) };
  if (!name) return { state: empty, classified: null, error: "empty_name", queued: [] };
  const r = applyOp(empty, { op: "add", sites: input.sites, traits: input.traits, request_render: input.request_render }, ctx);
  return r.error === "nothing_valid" ? { ...r, error: null } : r;
}

export const EDIT_MESSAGES: Record<EditError, string> = {
  limit: `A watchlist holds at most ${WATCH_LIMITS.sites} sites and ${WATCH_LIMITS.traits} signals.`,
  empty_name: "Give the watchlist a name.",
  nothing_valid: "Nothing to add: use tracked library domains or signal keys from the latest forecast.",
};

/** Console: watch · watch new <name> · watch add|rm <domain|trait> · watch open <id> · audit <a> <b> … */
export type ConsoleCmd =
  | { cmd: "panel" } | { cmd: "new"; name: string } | { cmd: "add" | "rm"; targets: string[] } | { cmd: "open"; id: string }
  | { cmd: "audit"; sites: string[] };
export function parseConsole(text: string): ConsoleCmd | null {
  const t = text.trim();
  if (/^watch$/i.test(t)) return { cmd: "panel" };
  let m = /^watch\s+new\s+(.+)$/i.exec(t); if (m) return { cmd: "new", name: cleanName(m[1]!) };
  m = /^watch\s+(add|rm|remove)\s+(.+)$/i.exec(t); if (m) return { cmd: m[1]!.toLowerCase() === "add" ? "add" : "rm", targets: splitTargets(m[2]!) };
  m = /^watch\s+open\s+(\S+)$/i.exec(t); if (m) { const id = /\/watch\/([A-Za-z0-9_-]{22})/.exec(m[1]!)?.[1] ?? m[1]!; return TOKEN_RE.test(id) ? { cmd: "open", id } : null; }
  m = /^audit(?:\s+(.+))?$/i.exec(t); if (m) return { cmd: "audit", sites: m[1] ? splitTargets(m[1]) : [] };
  return null;
}

/** Public shape of a watchlist (never includes the edit hash). */
export type WatchPublic = WatchState & { id: string; feed_token: string; created_at: string; updated_at: string };
export const viewPath = (id: string) => `/watch/${id}`;
export const editPath = (id: string, token: string) => `/watch/${id}?k=${token}`;
export const feedPath = (feedToken: string) => `/api/public/watch-feed/${feedToken}.xml`;
