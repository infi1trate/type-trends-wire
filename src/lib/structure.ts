// J1 + M1 · how a homepage is built and how it behaves on a phone. Pure: one record per brand, viewport and quarter derived from a
// capture's stored `nav`, `page`, `skeleton` (every capture since 2020) and `structure` (new crawler key, HOME captures only), the
// yes/no structure signals read from it, and the per-quarter counts the pages show. A missing reading is null ("not read"), never
// false or zero. Section roles are the crawler's rule-based guess. No AI anywhere.

export const STRUCTURE_FLOOR = 15;
export type Viewport = "desktop" | "mobile";
export const DESKTOP_SCREEN_PX = 900;
export const PHONE_SCREEN_PX = 844;

/** The 22 words whose lead position in top navigation is counted (1.2). */
export const NAV_WORDS = ["products", "product", "solutions", "platform", "features", "pricing", "customers", "resources", "docs", "developers", "company", "about", "blog", "enterprise", "ai", "careers", "shop", "stories", "learn", "community", "changelog", "download"] as const;
export type NavWord = (typeof NAV_WORDS)[number];
export const SIGNIN_WORDINGS = ["log in", "sign in", "login", "account"] as const;
export type SigninWording = (typeof SIGNIN_WORDINGS)[number];
export const SECTION_ROLES = ["hero", "logos", "cards", "feature", "stats", "testimonials", "pricing", "faq", "how", "integrations", "work", "news", "about", "signup", "code", "video", "ask", "content", "footer"] as const;
export const ROLE_NAME: Record<string, string> = { hero: "Hero", logos: "Logos", cards: "Cards", feature: "Feature", stats: "Numbers", testimonials: "Quotes", pricing: "Pricing", faq: "Questions", how: "How it works", integrations: "Integrations", work: "Work", news: "News", about: "About", signup: "Sign-up", code: "Code", video: "Video", ask: "Ask", content: "Content", footer: "Footer" };
export const ASK_NAME: Record<string, string> = { start: "Self-serve start", demo: "Demo", sales: "Talk to sales", waitlist: "Waitlist", download: "Download", shop: "Shop", subscribe: "Subscribe", signin: "Sign in", learn: "Learn more", other: "Other" };
export const PHONE_NAV_NAME: Record<string, string> = { drawer: "Menu drawer", bar: "Bottom bar", "drawer+bar": "Menu drawer and bottom bar", inline: "Links in the page", none: "No navigation" };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Input: one HOME capture, the fields read by JSON path. */
export type StructureInput = { id: number; domain: string; viewport: string; source: string; captured_at: string; nav?: unknown; page?: unknown; skeleton?: unknown; structure?: unknown; accent?: unknown };
export type Section = { r: string; y: number; h: number; t: string | null };
export type Ask = { l: string; k: string; p: boolean; n: boolean };
export type PhoneFields = { nav: string | null; tap_n: number | null; tap_med: number | null; tap_small: number | null; body_px: number | null; h1_px: number | null; sticky: string | null; smart_banner: boolean; store_links: number | null; store_first: number | null; app_prompt: boolean; overflow_x: boolean };
export type Furniture = Record<string, string | number | boolean | null>;
export type StructureRecord = {
  /** H fields (from nav, page, skeleton): null when the capture did not carry them. */
  nav_items: number | null; nav_depth: 1 | 2 | null; nav_labels: string[] | null; nav_words: NavWord[] | null; signin: SigninWording | null; signin_read: boolean;
  screens: number | null; first_buttons: number | null; bands: number | null;
  /** From the structure key; all null (or empty with structure_read false) when not read. */
  structure_read: boolean; roles: string[] | null; sections: Section[] | null; page_h: number | null;
  positions: Partial<Record<"logos" | "testimonials" | "pricing" | "faq" | "stats", number | null>> | null;
  primary_ask: string | null; asks: Ask[] | null; asks_n: number | null; start_and_demo: boolean | null;
  furniture: Furniture | null; mobile: PhoneFields | null; accent: string | null;
};

/** "Sign in Sign in" → "sign in"; "&" → "and"; lowercase, trimmed, single spaces. */
export function normLabel(raw: string): string {
  let s = raw.toLowerCase().replace(/&/g, " and ").replace(/\s+/g, " ").trim();
  const half = s.split(" "); if (half.length % 2 === 0 && half.length > 0) { const a = half.slice(0, half.length / 2).join(" "), b = half.slice(half.length / 2).join(" "); if (a === b) s = a; }
  return s;
}
/** "Sign in Sign in" → "Sign in" (the crawler reads a visible and a hidden copy of some labels). Case kept. */
export function undouble(l: string): string { const w = l.trim().split(/\s+/); if (w.length % 2 === 0) { const a = w.slice(0, w.length / 2).join(" "), b = w.slice(w.length / 2).join(" "); if (a.toLowerCase() === b.toLowerCase()) return a; } return w.join(" "); }
const LOGO = /(^|\s)home(page)?$|^navigate to home|^skip to|^go to home|^logo$|^back to top/;
/** Top-level navigation items: depth 1 and visible, logo/home and skip links left out. Fewer than two such items = not read. */
export function topLabels(nav: unknown): string[] | null {
  if (!Array.isArray(nav)) return null;
  const out: string[] = [];
  for (const n of nav) {
    if (!isObj(n) || n["depth"] !== 1 || n["visible"] !== true) continue;
    const l = str(n["label"]); if (!l) continue;
    const t = normLabel(l); if (!t || LOGO.test(t) || t.length > 40) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.length >= 2 ? out : null;
}
export const leadWord = (label: string): NavWord | null => { const w = label.split(" ")[0] ?? ""; return (NAV_WORDS as readonly string[]).includes(w) ? (w as NavWord) : null; };
export function signinOf(label: string): SigninWording | null {
  const t = label.replace(/[^a-z ]/g, "").trim();
  if (/^log in\b/.test(t)) return "log in";
  if (/^sign in\b/.test(t)) return "sign in";
  if (/^login\b/.test(t)) return "login";
  if (/^(my )?account$/.test(t)) return "account";
  return null;
}

const quarterOfDate = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
export const quarterOf = quarterOfDate;

export function deriveRecord(s: StructureInput): StructureRecord {
  const vp: Viewport = s.viewport === "mobile" ? "mobile" : "desktop";
  const labels = topLabels(s.nav);
  const words = labels ? [...new Set(labels.map(leadWord).filter((w): w is NavWord => !!w))] : null;
  const depth = Array.isArray(s.nav) ? (s.nav.some(n => isObj(n) && n["depth"] === 2) ? 2 : 1) : null;
  const st = isObj(s.structure) && s.structure["v"] != null ? s.structure : null;
  const furniture: Furniture | null = st && isObj(st["furniture"]) ? Object.fromEntries(Object.entries(st["furniture"]).filter(([, v]) => v == null || ["string", "number", "boolean"].includes(typeof v)).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 120) : v as number | boolean | null])) : st ? {} : null;
  let signin: SigninWording | null = null;
  for (const l of labels ?? []) { signin = signinOf(l); if (signin) break; }
  const login = furniture ? str(furniture["login"]) : null;
  if (!signin && login) signin = signinOf(normLabel(login));
  const page = isObj(s.page) ? s.page : null, ph = page ? num(page["h"]) : null;
  const screenPx = st ? num(st["vh"]) ?? (vp === "mobile" ? PHONE_SCREEN_PX : DESKTOP_SCREEN_PX) : vp === "mobile" ? PHONE_SCREEN_PX : DESKTOP_SCREEN_PX;
  const screens = st && num(st["screens"]) != null ? num(st["screens"]) : ph != null && ph > 0 ? Math.round((ph / screenPx) * 10) / 10 : null;
  const sk = Array.isArray(s.skeleton) ? s.skeleton.filter(isObj) : null;
  const firstButtons = sk ? sk.filter(b => b["kind"] === "control" && (num(b["y"]) ?? 1e9) < screenPx).length : null;
  const bands = sk ? sk.filter(b => b["kind"] === "section").length : null;
  const sections: Section[] | null = st && Array.isArray(st["sections"]) ? st["sections"].filter(isObj).flatMap(x => { const r = str(x["r"]); return r ? [{ r, y: num(x["y"]) ?? 0, h: Math.max(0, num(x["h"]) ?? 0), t: str(x["t"])?.slice(0, 48) ?? null }] : []; }) : st ? [] : null;
  const asks: Ask[] | null = st && Array.isArray(st["asks"]) ? st["asks"].filter(isObj).flatMap(x => { const l = str(x["l"]), k = str(x["k"]); return l && k ? [{ l: undouble(l).slice(0, 48), k, p: x["p"] === 1 || x["p"] === true, n: x["n"] === 1 || x["n"] === true }] : []; }).slice(0, 8) : st ? [] : null;
  const pageH = sections && sections.length ? Math.max(ph ?? 0, ...sections.map(x => x.y + x.h)) : ph;
  const pos = (r: string) => { const x = sections?.find(y => y.r === r); return x && pageH ? Math.round((x.y / pageH) * 100) / 100 : null; };
  const primary = asks ? (asks.find(a => a.p) ?? asks[0] ?? null) : null;
  const m = st && vp === "mobile" && isObj(st["mobile"]) ? st["mobile"] : null;
  const mobile: PhoneFields | null = m ? { nav: str(m["nav"]), tap_n: num(m["tap_n"]), tap_med: num(m["tap_med"]), tap_small: num(m["tap_small"]), body_px: num(m["body_px"]), h1_px: num(m["h1_px"]), sticky: str(m["sticky"]), smart_banner: !!m["smart_banner"], store_links: num(m["store_links"]), store_first: num(m["store_first"]), app_prompt: !!m["app_prompt"], overflow_x: !!m["overflow_x"] } : null;
  const accent = typeof s.accent === "string" && /^#[0-9a-f]{3,8}$/i.test(s.accent) ? s.accent : null;
  return {
    nav_items: labels ? labels.length : null, nav_depth: labels ? (depth as 1 | 2) : null, nav_labels: labels, nav_words: words, signin, signin_read: !!labels || !!furniture,
    screens, first_buttons: firstButtons, bands,
    structure_read: !!st, roles: sections ? sections.map(x => x.r) : null, sections, page_h: pageH,
    positions: st ? { logos: pos("logos"), testimonials: pos("testimonials"), pricing: pos("pricing"), faq: pos("faq"), stats: pos("stats") } : null,
    primary_ask: primary?.k ?? null, asks, asks_n: asks ? asks.length : null, start_and_demo: asks ? asks.some(a => a.k === "start") && asks.some(a => a.k === "demo" || a.k === "sales") : null,
    furniture, mobile, accent,
  };
}

export type SignalSource = "history" | "new";
export type StructureSignal = { key: string; name: string; meaning: string; group: "nav" | "ask" | "furniture" | "page" | "phone"; source: SignalSource; viewports: readonly Viewport[]; read: (r: StructureRecord) => boolean | null };
const both = ["desktop", "mobile"] as const, desk = ["desktop"] as const, phone = ["mobile"] as const;
const navHas = (w: NavWord) => (r: StructureRecord) => (r.nav_words ? r.nav_words.includes(w) : null);
const f = (k: string) => (r: StructureRecord) => (r.furniture ? !!r.furniture[k] : null);
const hasRole = (role: string) => (r: StructureRecord) => (r.roles && r.structure_read ? r.roles.includes(role) : null);
const ph = (fn: (m: PhoneFields) => boolean | null) => (r: StructureRecord) => (r.mobile ? fn(r.mobile) : null);
/** 1.3 · the first set. Navigation and page length carry history from 2020 (nav, page); the rest start when the new key arrived. */
export const STRUCTURE_SIGNALS: readonly StructureSignal[] = [
  { key: "nav:says_solutions", name: "Navigation says Solutions", meaning: "A top-level navigation item starts with “Solutions”.", group: "nav", source: "history", viewports: desk, read: navHas("solutions") },
  { key: "nav:says_products", name: "Navigation says Products", meaning: "A top-level navigation item starts with “Products” or “Product”.", group: "nav", source: "history", viewports: desk, read: r => (r.nav_words ? r.nav_words.includes("products") || r.nav_words.includes("product") : null) },
  { key: "nav:says_platform", name: "Navigation says Platform", meaning: "A top-level navigation item starts with “Platform”.", group: "nav", source: "history", viewports: desk, read: navHas("platform") },
  { key: "nav:has_pricing", name: "Pricing in the navigation", meaning: "A top-level navigation item starts with “Pricing”.", group: "nav", source: "history", viewports: desk, read: navHas("pricing") },
  { key: "nav:has_docs", name: "Docs in the navigation", meaning: "A top-level navigation item starts with “Docs” or “Developers”.", group: "nav", source: "history", viewports: desk, read: r => (r.nav_words ? r.nav_words.includes("docs") || r.nav_words.includes("developers") : null) },
  { key: "nav:has_ai", name: "AI in the navigation", meaning: "A top-level navigation item is or starts with “AI”.", group: "nav", source: "history", viewports: desk, read: navHas("ai") },
  { key: "nav:has_customers", name: "Customers in the navigation", meaning: "A top-level navigation item starts with “Customers”.", group: "nav", source: "history", viewports: desk, read: navHas("customers") },
  { key: "nav:signin_wording_login", name: "Sign-in says Log in", meaning: "The sign-in item reads “Log in” or “Login”, of the brands with a sign-in item.", group: "nav", source: "history", viewports: desk, read: r => (r.signin ? r.signin === "log in" || r.signin === "login" : null) },
  { key: "nav:signin_wording_signin", name: "Sign-in says Sign in", meaning: "The sign-in item reads “Sign in”, of the brands with a sign-in item.", group: "nav", source: "history", viewports: desk, read: r => (r.signin ? r.signin === "sign in" : null) },
  { key: "nav:deep", name: "Menus inside the navigation", meaning: "The navigation opens menus with a second level of links.", group: "nav", source: "history", viewports: desk, read: r => (r.nav_depth == null ? null : r.nav_depth === 2) },
  { key: "nav:long", name: "Eight or more navigation items", meaning: "The top navigation has eight or more items.", group: "nav", source: "history", viewports: desk, read: r => (r.nav_items == null ? null : r.nav_items >= 8) },
  { key: "ask:start", name: "Primary ask is a self-serve start", meaning: "The main call to action on the first screen lets you start on your own.", group: "ask", source: "new", viewports: both, read: r => (r.asks && r.asks.length ? r.primary_ask === "start" : null) },
  { key: "ask:demo", name: "Primary ask is a demo", meaning: "The main call to action on the first screen asks for a demo or a sales call.", group: "ask", source: "new", viewports: both, read: r => (r.asks && r.asks.length ? r.primary_ask === "demo" || r.primary_ask === "sales" : null) },
  { key: "ask:both", name: "Asks for a start and a demo", meaning: "The first screen offers both a self-serve start and a demo or sales call.", group: "ask", source: "new", viewports: both, read: r => r.start_and_demo },
  { key: "ask:three_plus", name: "Three or more asks on the first screen", meaning: "Three or more calls to action on the first screen.", group: "ask", source: "new", viewports: both, read: r => (r.asks_n == null ? null : r.asks_n >= 3) },
  { key: "furn:search", name: "Search on the homepage", meaning: "A search box or button on the homepage.", group: "furniture", source: "new", viewports: both, read: f("search") },
  { key: "furn:cmdk", name: "A command menu", meaning: "A ⌘K command menu on the homepage.", group: "furniture", source: "new", viewports: both, read: f("cmdk") },
  { key: "furn:chat", name: "A chat widget", meaning: "A support chat widget on the homepage.", group: "furniture", source: "new", viewports: both, read: f("chat") },
  { key: "furn:ask_ai", name: "An ask-AI box on the homepage", meaning: "An “Ask AI” button or a prompt box on the homepage.", group: "furniture", source: "new", viewports: both, read: r => (r.furniture ? !!r.furniture["ask_ai"] || !!r.furniture["prompt_box"] : null) },
  { key: "furn:lang_switch", name: "A language switch", meaning: "A control to change the page's language.", group: "furniture", source: "new", viewports: both, read: f("lang_switch") },
  { key: "furn:announcement_bar", name: "An announcement bar", meaning: "A strip of news above the navigation.", group: "furniture", source: "new", viewports: both, read: f("bar") },
  { key: "furn:theme_toggle", name: "A light and dark switch", meaning: "A control to switch between light and dark.", group: "furniture", source: "new", viewports: both, read: f("theme_toggle") },
  { key: "page:has_logos", name: "A wall of customer logos", meaning: "A section of customer or partner logos.", group: "page", source: "new", viewports: both, read: hasRole("logos") },
  { key: "page:has_testimonials", name: "Customer quotes", meaning: "A section of testimonials.", group: "page", source: "new", viewports: both, read: hasRole("testimonials") },
  { key: "page:has_pricing_section", name: "Pricing on the homepage", meaning: "A pricing section on the homepage itself.", group: "page", source: "new", viewports: both, read: hasRole("pricing") },
  { key: "page:has_faq", name: "Questions and answers", meaning: "A questions section on the homepage.", group: "page", source: "new", viewports: both, read: hasRole("faq") },
  { key: "page:has_stats", name: "A row of numbers", meaning: "A section of headline numbers.", group: "page", source: "new", viewports: both, read: hasRole("stats") },
  { key: "page:long", name: "A long homepage", meaning: "The homepage runs ten screens or more.", group: "page", source: "history", viewports: both, read: r => (r.screens == null ? null : r.screens >= 10) },
  { key: "page:short", name: "A short homepage", meaning: "The homepage runs four screens or fewer.", group: "page", source: "history", viewports: both, read: r => (r.screens == null ? null : r.screens <= 4) },
  { key: "phone:drawer", name: "A menu drawer on phones", meaning: "On a phone, the navigation folds into a drawer.", group: "phone", source: "new", viewports: phone, read: ph(m => (m.nav ? m.nav === "drawer" || m.nav === "drawer+bar" : null)) },
  { key: "phone:bottom_bar", name: "Bottom navigation bar on phones", meaning: "On a phone, a navigation bar sits at the bottom of the screen.", group: "phone", source: "new", viewports: phone, read: ph(m => (m.nav ? m.nav === "bar" || m.nav === "drawer+bar" : null)) },
  { key: "phone:sticky_ask", name: "An ask that stays on screen", meaning: "On a phone, a call to action stays on screen as you scroll.", group: "phone", source: "new", viewports: phone, read: ph(m => !!m.sticky) },
  { key: "phone:app_push", name: "Pushes you to the app", meaning: "On a phone, a banner, prompt or store link first sends you to the app.", group: "phone", source: "new", viewports: phone, read: ph(m => m.smart_banner || m.app_prompt || (m.store_first ?? 0) >= 1) },
  { key: "phone:small_taps", name: "Small tap targets", meaning: "On a phone, 40% or more of the tap targets in the first two screens are under 44 px.", group: "phone", source: "new", viewports: phone, read: ph(m => (m.tap_small == null ? null : m.tap_small >= 40)) },
  { key: "phone:small_text", name: "Body text under 16 px", meaning: "On a phone, body text is set under 16 px.", group: "phone", source: "new", viewports: phone, read: ph(m => (m.body_px == null ? null : m.body_px < 16)) },
  { key: "phone:sideways_scroll", name: "Scrolls sideways", meaning: "On a phone, the page is wider than the screen.", group: "phone", source: "new", viewports: phone, read: ph(m => m.overflow_x) },
];
export const STRUCTURE_BY_KEY = new Map(STRUCTURE_SIGNALS.map(s => [s.key, s]));
export const isStructureKey = (k: string) => STRUCTURE_BY_KEY.has(k);
/** Navigation-word series (for /patterns/navigation): desktop, from 2020. */
export const navWordKey = (w: NavWord) => `navword:${w}`;
export const signinKey = (w: SigninWording) => `signin:${w}`;

/** Every flag for one record: true/false when read, null when not. Only keys the viewport reads are present. */
export function flagsOf(r: StructureRecord, vp: Viewport): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const s of STRUCTURE_SIGNALS) if (s.viewports.includes(vp)) out[s.key] = s.read(r);
  if (vp === "desktop") {
    for (const w of NAV_WORDS) out[navWordKey(w)] = r.nav_words ? r.nav_words.includes(w) : null;
    for (const w of SIGNIN_WORDINGS) out[signinKey(w)] = r.signin ? r.signin === w : null;
  }
  return out;
}

/** Which capture stands for the quarter: one with the structure key, then live over archived, then newest. */
export function better(a: { structure_read: boolean; source: string; captured_at: string; navRead?: boolean }, b: typeof a): boolean {
  const score = (x: typeof a) => (x.structure_read ? 4 : 0) + (x.navRead ? 2 : 0) + (x.source === "live" ? 1 : 0);
  return score(a) !== score(b) ? score(a) > score(b) : a.captured_at > b.captured_at;
}

export type RecordRow = { domain: string; viewport: Viewport; quarter: string; snapshot_id: number; source: string; captured_at: string; structure_read: boolean; record: StructureRecord; flags: Record<string, boolean | null> };
export function toRow(s: StructureInput): RecordRow {
  const vp: Viewport = s.viewport === "mobile" ? "mobile" : "desktop", record = deriveRecord(s);
  return { domain: s.domain, viewport: vp, quarter: quarterOf(s.captured_at), snapshot_id: s.id, source: s.source, captured_at: s.captured_at, structure_read: record.structure_read, record, flags: flagsOf(record, vp) };
}
/** Keep the better row per (domain, viewport, quarter). */
export function pickRows(rows: readonly RecordRow[]): RecordRow[] {
  const m = new Map<string, RecordRow>();
  for (const r of rows) { const k = `${r.domain}|${r.viewport}|${r.quarter}`, o = m.get(k); if (!o || better({ ...r, navRead: r.record.nav_items != null }, { ...o, navRead: o.record.nav_items != null })) m.set(k, r); }
  return [...m.values()];
}

export type SeriesRow = { signal: string; viewport: Viewport; scope: string; quarter: string; n_read: number; n_yes: number };
/** Counts per signal, viewport, scope (all, sector, cat:<sector>/<category> for the latest quarter only) and quarter. Not-read rows are not counted. */
export function buildSeries(rows: readonly Pick<RecordRow, "domain" | "viewport" | "quarter" | "flags">[], classes: ReadonlyMap<string, { sector: string | null; category: string | null }>, latest: string): SeriesRow[] {
  const m = new Map<string, SeriesRow>();
  const add = (signal: string, vp: Viewport, scope: string, q: string, yes: boolean) => {
    const k = `${signal}|${vp}|${scope}|${q}`; let s = m.get(k);
    if (!s) m.set(k, s = { signal, viewport: vp, scope, quarter: q, n_read: 0, n_yes: 0 });
    s.n_read++; if (yes) s.n_yes++;
  };
  for (const r of rows) {
    const c = classes.get(r.domain);
    for (const [k, v] of Object.entries(r.flags)) {
      if (v == null) continue;
      add(k, r.viewport, "all", r.quarter, v);
      if (c?.sector) add(k, r.viewport, c.sector, r.quarter, v);
      if (c?.sector && c.category && r.quarter === latest) add(k, r.viewport, `cat:${c.sector}/${c.category}`, r.quarter, v);
    }
  }
  return [...m.values()];
}

/** A share only on STRUCTURE_FLOOR or more brands with the reading; otherwise null (shown as "Too few brands read"). */
export const shareOf = (s: { n_read: number; n_yes: number } | null | undefined): number | null => (s && s.n_read >= STRUCTURE_FLOOR ? s.n_yes / s.n_read : null);
export const passesFloor = (s: { n_read: number } | null | undefined) => !!s && s.n_read >= STRUCTURE_FLOOR;
export const NOT_READ = "Not read yet. slug reads page structure on the next weekly pass.";
export const TOO_FEW = `Fewer than ${STRUCTURE_FLOOR} brands read yet.`;
export const pctText = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
/** "Desktop 41% · Phone 28%", each side only past the floor. */
export function desktopPhone(d: { n_read: number; n_yes: number } | null | undefined, p: { n_read: number; n_yes: number } | null | undefined): { desktop: number | null; phone: number | null; line: string | null } {
  const a = shareOf(d), b = shareOf(p);
  if (a == null && b == null) return { desktop: null, phone: null, line: null };
  return { desktop: a, phone: b, line: `Desktop ${a == null ? "too few read" : pctText(a)} · Phone ${b == null ? "too few read" : pctText(b)}` };
}

/** The first quarter a signal can be shown library-wide (15+ brands read), for "starts in …" notes. */
export function firstShownQuarter(series: readonly SeriesRow[], signal: string, vp: Viewport): string | null {
  return series.filter(s => s.signal === signal && s.viewport === vp && s.scope === "all" && s.n_read >= STRUCTURE_FLOOR).map(s => s.quarter).sort()[0] ?? null;
}
/** Quarters back from `q` ("2026Q4", 20 → "2021Q4"). */
export function quarterBack(q: string, n: number): string {
  const y = Number(q.slice(0, 4)), k = Number(q.slice(5)) - 1, t = y * 4 + k - n;
  return `${Math.floor(t / 4)}Q${(t % 4) + 1}`;
}
export const quarterLabel = (q: string) => `Q${q.slice(5)} ${q.slice(0, 4)}`;

/** The data desk's line: three signals with the largest four-quarter change in library-wide desktop share (both ends past the floor). */
export function biggestChanges(series: readonly SeriesRow[], latest: string, n = 3): { signal: string; from: number; to: number }[] {
  const at = new Map(series.filter(s => s.scope === "all" && s.viewport === "desktop").map(s => [`${s.signal}|${s.quarter}`, s]));
  const back = quarterBack(latest, 4);
  return STRUCTURE_SIGNALS.flatMap(s => { const a = shareOf(nearestRead(series, s.key, "desktop", back)), b = shareOf(at.get(`${s.key}|${latest}`)); return a != null && b != null ? [{ signal: s.key, from: a, to: b }] : []; })
    .sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from)).slice(0, n);
}

/** JSON/MCP summary for one brand (2.6). */
export function structureSummary(r: StructureRecord | null | undefined) {
  if (!r) return null;
  return { read: r.structure_read, sections: r.roles, primary_ask: r.primary_ask, nav_items: r.nav_items, furniture: r.furniture ? Object.keys(r.furniture).filter(k => r.furniture![k]) : null, phone_nav: r.mobile?.nav ?? null };
}

const qIndex = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
/** Archive captures come about twice a year, so a "then" quarter is the nearest one with STRUCTURE_FLOOR brands read within two
 *  quarters of the target (earlier first on a tie); null when none. */
export function nearestRead(rows: readonly SeriesRow[], signal: string, vp: Viewport, target: string, within = 2): SeriesRow | null {
  const t = qIndex(target);
  return covered(rows.filter(r => r.scope === "all")).filter(r => r.signal === signal && r.viewport === vp && r.scope === "all" && r.n_read >= STRUCTURE_FLOOR && Math.abs(qIndex(r.quarter) - t) <= within)
    .sort((a, b) => Math.abs(qIndex(a.quarter) - t) - Math.abs(qIndex(b.quarter) - t) || a.quarter.localeCompare(b.quarter))[0] ?? null;
}

export type StructureFacts = { desktop: number; phone: number; fresh_desktop: number; fresh_phone: number; passing: number; total: number; changes: { signal: string; from: number; to: number }[] };
export const STRUCTURE_FRESH_DAYS = 14;
/** The data desk's weekly structure line (3.1). */
export function structureDeskLine(f: StructureFacts): string {
  const ch = f.changes.length ? f.changes.map(c => `${STRUCTURE_BY_KEY.get(c.signal)?.name ?? c.signal} ${pctText(c.from)} → ${pctText(c.to)}`).join("; ") : "none with four quarters of history past the floor";
  return `Structure: ${f.desktop} brands read on desktop, ${f.phone} on a phone; ${f.passing} of ${f.total} structure signals pass the ${STRUCTURE_FLOOR}-brand floor; changed most over four quarters: ${ch}.`;
}
/** The health endpoint's library line addition (3.2). */
export const structureHealthLine = (f: Pick<StructureFacts, "fresh_desktop" | "fresh_phone">) => `structure read in the last ${STRUCTURE_FRESH_DAYS} days: ${f.fresh_desktop} brands on desktop, ${f.fresh_phone} on a phone`;

/** Well covered: STRUCTURE_FLOOR brands read and at least a quarter of the most brands this signal was ever read on, so the live-only
 *  quarters between twice-yearly archive copies (10–15 brands) never draw a zig-zag against archive quarters (150+). */
export function covered<T extends { signal: string; viewport: string; n_read: number }>(rows: readonly T[]): T[] {
  const max = new Map<string, number>();
  for (const r of rows) { const k = `${r.signal}|${r.viewport}`; max.set(k, Math.max(max.get(k) ?? 0, r.n_read)); }
  return rows.filter(r => r.n_read >= Math.max(STRUCTURE_FLOOR, 0.25 * (max.get(`${r.signal}|${r.viewport}`) ?? 0)));
}
