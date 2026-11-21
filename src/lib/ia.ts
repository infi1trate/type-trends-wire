// One information architecture: seven sections, four object types, two modes. Pure.
// Every page route, old terminal panel, terminal tab, key and console command family resolves through this file (ia.test.ts checks for orphans).

export type SectionId = "live" | "signals" | "brands" | "patterns" | "studies" | "digest" | "tools";
export type Mode = "read" | "terminal";
export type Section = { id: SectionId; label: string; purpose: string; read: string; terminal: TabId; key: string };

/** The four object types; every object page renders the same four blocks in this order. */
export const OBJECT_TYPES = ["signal", "brand", "story", "pattern"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];
export const OBJECT_BLOCKS = ["headline", "evidence", "so-what", "related"] as const;
export type Block = (typeof OBJECT_BLOCKS)[number];
export const BLOCK_TITLE: Record<Block, string> = { headline: "Headline", evidence: "Evidence", "so-what": "So what", related: "Related" };

/** Terminal tabs, grouped by section. Old panel ids stay as tab ids so every stored link keeps resolving. */
export const TABS = [
  { id: "today", section: "live", label: "TODAY" },
  { id: "wire", section: "live", label: "WIRE" },
  { id: "overview", section: "signals", label: "ALL SIGNALS" },
  { id: "type", section: "signals", label: "TYPE" },
  { id: "color", section: "signals", label: "COLOR" },
  { id: "layout", section: "signals", label: "LAYOUT" },
  { id: "lexicon", section: "signals", label: "VOICE" },
  { id: "vibe", section: "signals", label: "VIBE MAP" },
  { id: "brief", section: "signals", label: "FORECAST" },
  { id: "library", section: "brands", label: "DIRECTORY" },
  { id: "rebrands", section: "brands", label: "MOVES" },
  { id: "history", section: "brands", label: "HISTORY" },
  { id: "patterns", section: "patterns", label: "PATTERNS" },
  { id: "studies", section: "studies", label: "STUDIES" },
  { id: "digest", section: "digest", label: "ISSUES" },
  { id: "morning", section: "digest", label: "MORNING LINE" },
  { id: "sectors", section: "digest", label: "SECTOR REPORTS" },
  { id: "watch", section: "tools", label: "WATCH" },
  { id: "audit", section: "tools", label: "AUDIT" },
  { id: "ledger", section: "tools", label: "LEDGER" },
  { id: "console", section: "tools", label: "CONSOLE" },
] as const satisfies readonly { id: string; section: SectionId; label: string }[];
export type TabId = (typeof TABS)[number]["id"];
/** A terminal view: a tab, or a sub-view inside one (Composition lives inside the Layout tab). */
export type ViewId = TabId | "composition";
export const SUB_VIEWS: Record<"composition", TabId> = { composition: "layout" };

/** U3 · the seven sections, in one order for both modes: the Read bar and the terminal's F-keys both come from here. */
export const SECTIONS: readonly Section[] = [
  { id: "live", label: "Today", purpose: "The front page: today's stories, the tape of confirmed changes and the rest of the week.", read: "/", terminal: "today", key: "F1" },
  { id: "signals", label: "Signals", purpose: "The design signals worth a decision, ranked, each with its receipts.", read: "/signals", terminal: "overview", key: "F2" },
  { id: "brands", label: "Brands", purpose: "Who is doing it: tracked brands, their identity and every confirmed move.", read: "/brands", terminal: "library", key: "F3" },
  { id: "patterns", label: "Patterns", purpose: "Signals seen as examples: the brands that show each layout pattern.", read: "/patterns", terminal: "patterns", key: "F4" },
  { id: "studies", label: "Studies", purpose: "Longer arguments from the stored history: each study, its figures and the check that keeps it live.", read: "/data", terminal: "studies", key: "F5" },
  { id: "digest", label: "Digest", purpose: "The editions: the daily Morning Line, the weekly Digest and quarterly sector reports.", read: "/digest", terminal: "digest", key: "F6" },
  { id: "tools", label: "Tools", purpose: "Where to act: audits, watchlists, the forecast ledger and agent access.", read: "/tools", terminal: "watch", key: "F7" },
];

/** EDITIONS — the shapes people subscribe to in their heads, all under the Digest section, each with its rhythm. */
export const EDITIONS = [
  { id: "morning", name: "The Morning Line", rhythm: "Daily", read: "/morning", tab: "morning", what: "The day's lead, five more stories ranked by score, Moving now, one opening and what the desk held." },
  { id: "digest", name: "The Digest", rhythm: "Weekly", read: "/digest", tab: "digest", what: "One argument a week: the five changes that mattered, three pictures and one chart, from the stories that ran." },
  { id: "sectors", name: "Sector reports", rhythm: "Quarterly", read: "/sectors", tab: "sectors", what: "The state of one sector this quarter: its signals against all sectors, white space, counter-moves, leaders and patterns." },
] as const satisfies readonly { id: string; name: string; rhythm: string; read: string; tab: TabId; what: string }[];

/** The fourteen panels the terminal had before Phase 13, with their old keys (kept for aliases and tests). */
export const LEGACY_PANELS = [
  { key: "T", id: "today", label: "TODAY" },
  { key: "F1", id: "overview", label: "SIGNALS" },
  { key: "F2", id: "type", label: "TYPE" },
  { key: "F3", id: "color", label: "COLOR" },
  { key: "F4", id: "layout", label: "LAYOUT" },
  { key: "F5", id: "composition", label: "COMPOSITION" },
  { key: "F6", id: "lexicon", label: "LEXICON" },
  { key: "F7", id: "vibe", label: "VIBE" },
  { key: "F8", id: "wire", label: "WIRE" },
  { key: "F9", id: "rebrands", label: "REBRANDS" },
  { key: "F10", id: "brief", label: "FORECAST" },
  { key: "F11", id: "library", label: "LIBRARY" },
  { key: "F12", id: "history", label: "HISTORY" },
  { key: "W", id: "watch", label: "WATCH" },
] as const;

/** Other names that still open the right view (muscle memory, shared links, section ids). */
export const VIEW_ALIASES: Record<string, ViewId> = {
  ticker: "overview", signals: "overview", forecast: "brief", spread: "overview", voice: "lexicon", directory: "library", moves: "rebrands",
  issues: "digest", editions: "digest", morning_line: "morning", sector: "sectors", reports: "sectors", live: "today", brands: "library", tools: "watch", help: "console", stories: "today",
};
const isView = (v: string): v is ViewId => v === "composition" || TABS.some(t => t.id === v);
export function resolveView(id: unknown): ViewId {
  if (typeof id !== "string" || !id) return "today";
  const v = id.toLowerCase();
  return isView(v) ? v : VIEW_ALIASES[v] ?? "today";
}
export const tabOf = (v: ViewId): TabId => (v === "composition" ? SUB_VIEWS.composition : v);
export const sectionOf = (v: ViewId): SectionId => TABS.find(t => t.id === tabOf(v))!.section;
export const sectionById = (id: SectionId) => SECTIONS.find(s => s.id === id)!;
export const tabsIn = (s: SectionId) => TABS.filter(t => t.section === s);
/** Next/previous tab inside the view's section, wrapping. */
export function stepTab(v: ViewId, dir: 1 | -1): TabId {
  const tabs = tabsIn(sectionOf(v)), i = tabs.findIndex(t => t.id === tabOf(v));
  return tabs[(i + dir + tabs.length) % tabs.length]!.id;
}

// KEYS — F1–F7 (and 1–7) open the seven sections; old keys are aliases to where their panel now lives. U3: F7 is Tools now, so the old
// F7 (Vibe map) alias gave way; F5 and F6 open Studies and Digest (Digest keeps D, Tools keeps W).
export type KeyTarget = { section: SectionId } | { view: ViewId } | { action: "glossary" | "console" | "mode" | "prev-tab" | "next-tab" | "close" };
export type KeyDef = { key: string; target: KeyTarget; label: string; alias?: true };
export const KEY_MAP: readonly KeyDef[] = [
  ...SECTIONS.map(s => ({ key: s.key, target: { section: s.id }, label: s.label })),
  { key: "T", target: { view: "today" }, label: "Today", alias: true },
  { key: "F8", target: { view: "wire" }, label: "Today · Wire", alias: true },
  { key: "F9", target: { view: "rebrands" }, label: "Brands · Moves", alias: true },
  { key: "F10", target: { view: "brief" }, label: "Signals · Forecast", alias: true },
  { key: "F11", target: { view: "library" }, label: "Brands · Directory", alias: true },
  { key: "F12", target: { view: "history" }, label: "Brands · History", alias: true },
  { key: "W", target: { view: "watch" }, label: "Tools · Watch", alias: true },
  { key: "D", target: { section: "digest" }, label: "Digest", alias: true },
  { key: "[", target: { action: "prev-tab" }, label: "Previous tab (also ←)" },
  { key: "]", target: { action: "next-tab" }, label: "Next tab (also →)" },
  { key: "`", target: { action: "mode" }, label: "Switch Read ⇄ Terminal" },
  { key: "?", target: { action: "glossary" }, label: "Glossary" },
  { key: "/", target: { action: "console" }, label: "Console" },
  { key: "Esc", target: { action: "close" }, label: "Close overlay" },
];
/** A pressed key (event.key) → its definition. Letters are case-insensitive; digits 1–7 open sections; ArrowLeft/Right step tabs. */
export function resolveKey(key: string): KeyDef | null {
  if (/^[1-7]$/.test(key)) return KEY_MAP.find(k => k.key === `F${key}`) ?? null;
  if (key === "ArrowLeft") return KEY_MAP.find(k => k.key === "[") ?? null;
  if (key === "ArrowRight") return KEY_MAP.find(k => k.key === "]") ?? null;
  if (key === "Escape") return KEY_MAP.find(k => k.key === "Esc") ?? null;
  const k = key.length === 1 ? key.toUpperCase() : key;
  return KEY_MAP.find(d => d.key === k) ?? null;
}
/** The view a key opens (sections open their first tab), or null for actions. */
export const keyView = (d: KeyDef | null): ViewId | null => (!d ? null : "view" in d.target ? d.target.view : "section" in d.target ? sectionById(d.target.section).terminal : null);

// URLS — the terminal lives at /terminal; `/` is always Read.
export type TerminalSearch = { panel?: string; sector?: string; q?: string; sort?: string; desc?: boolean; page?: number; cmd?: string | undefined; trait?: string | undefined; story?: string | undefined };
const enc = encodeURIComponent;
const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false).map(([k, v]) => `${k}=${enc(String(v))}`);
  return p.length ? `?${p.join("&")}` : "";
};
const lensOf = (s: Record<string, unknown>) => (typeof s["sector"] === "string" && s["sector"] && s["sector"] !== "all" ? (s["sector"] as string) : undefined);
/** A terminal view's address; an object view inside it (a story, signal or pattern) comes back as that object's one address in the Data view. */
export const terminalHref = (view: ViewId, extra: { trait?: string | undefined; sector?: string | undefined; cmd?: string | undefined; story?: string | undefined } = {}) =>
  canonicalHref(`/terminal${qs({ panel: view, trait: extra.trait, sector: extra.sector && extra.sector !== "all" ? extra.sector : undefined, cmd: extra.cmd, story: extra.story })}`);
/** A console command opened in Terminal mode, prefilled. */
export const consoleHref = (cmd: string, sector?: string) => terminalHref("console", { cmd, sector });
export const signalPath = (key: string) => `/signals/${enc(key)}`;
export const brandPath = (domain: string) => `/brands/${enc(domain)}`;
/** A brand's Data view (the dense record that used to live at /library/<domain>). */
export const brandDataPath = (domain: string) => `/brands/${enc(domain)}?view=data`;
export const patternPath = (key: string) => `/patterns/${enc(key)}`;
export const storyHref = (id: string) => `/stories/${enc(id)}`;

/** Search params only the old terminal at `/` used; any of them on `/` means an old terminal link. */
export const LEGACY_PARAMS = ["panel", "trait", "cmd", "q", "sort", "desc", "alert"] as const;
/** Old `/?panel=…` links → the matching /terminal search (panel resolved through the alias map), or null when `/` should render Live. */
export function legacyTerminalSearch(raw: Record<string, unknown>): TerminalSearch | null {
  if (!LEGACY_PARAMS.some(k => raw[k] !== undefined && raw[k] !== "")) return null;
  const s = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const out: TerminalSearch = { panel: resolveView(s("panel") ?? "today") };
  for (const k of ["sector", "q", "sort", "cmd", "trait"] as const) { const v = s(k); if (v !== undefined) out[k] = v; }
  if (raw["desc"] === true || raw["desc"] === "true") out.desc = true;
  if (typeof raw["page"] === "number") out.page = raw["page"]; else if (typeof raw["page"] === "string" && /^\d+$/.test(raw["page"])) out.page = Number(raw["page"]);
  return out;
}
// ONE ADDRESS PER THING (U1) — every object has one address, its Read address; `?view=data` on it is the object's Data view (the
// terminal's dark shell). The switch flips the view and nothing else: path, sector lens and filters stay.
export const VIEW_OBJECTS = ["story", "brand", "signal", "pattern", "study", "week"] as const;
export type ViewObject = (typeof VIEW_OBJECTS)[number];
export type ObjectRef = { type: ViewObject; id: string };
const OBJECT_SEGMENT: Record<string, ViewObject> = { stories: "story", brands: "brand", signals: "signal", patterns: "pattern", data: "study", digest: "week" };
const PATH_OF: Record<ViewObject, string> = { story: "stories", brand: "brands", signal: "signals", pattern: "patterns", study: "data", week: "digest" };
/** Second segments that are pages of their own, not objects (a number redirect, indicators, a tool, the archive). */
const NOT_OBJECT: Record<string, readonly string[]> = { stories: ["no"], signals: ["leading"], data: ["where-you-sit", "embed"], digest: ["archive"] };
const decodeSeg = (x: string) => { try { return decodeURIComponent(x); } catch { return x; } };
/** The object an address names, or null for section pages, files and feeds. */
export function objectOf(pathname: string): ObjectRef | null {
  const seg = pathname.split("/").filter(Boolean).map(decodeSeg);
  if (seg.length !== 2) return null;
  const [a, b] = seg as [string, string], type = OBJECT_SEGMENT[a];
  if (!type || !b || NOT_OBJECT[a]?.includes(b) || /\.(png|svg|xml|json|csv)$/i.test(b)) return null;
  if (type === "week" && !/^\d{4}-W\d{2}$/.test(b)) return null;
  return { type, id: b };
}
export const objectPath = (o: ObjectRef) => `/${PATH_OF[o.type]}/${enc(o.id)}`;
/** Search params only a Data view reads (the brand record's compare tool); they are dropped on the way back to Read. */
export const DATA_ONLY_PARAMS = ["viewport", "page_type", "a", "b"] as const;
/** Params that never carry across a view switch: the view itself and an open receipt drawer (Read only). */
const SWITCH_DROPS = ["view", "receipt"];
const keepParams = (search: Record<string, unknown>, drop: readonly string[]) => Object.fromEntries(Object.entries(search).filter(([k, v]) => !drop.includes(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")).map(([k, v]) => [k, v as string | number | boolean]));
/** An object's Data view address, keeping the given params (sector and filters) and putting `view=data` last. */
export const dataHref = (o: ObjectRef, search: Record<string, unknown> = {}) => `${objectPath(o)}${qs({ ...keepParams(search, SWITCH_DROPS), view: "data" })}`;
/** An object's Read address, keeping the sector lens and filters, dropping Data-only params. */
export const readHref = (o: ObjectRef, search: Record<string, unknown> = {}) => `${objectPath(o)}${qs(keepParams(search, [...SWITCH_DROPS, ...DATA_ONLY_PARAMS]))}`;
/** Reader-facing names of the object types, one per type, used by both views (Part 4: one name per thing). */
export const OBJECT_NAME: Record<ViewObject, string> = { story: "Story", brand: "Brand", signal: "Signal", pattern: "Pattern", study: "Study", week: "The Digest" };
/** The section an object belongs to (F-keys and [ ] in its Data view work from there). */
export const OBJECT_SECTION: Record<ViewObject, SectionId> = { story: "live", brand: "brands", signal: "signals", pattern: "patterns", study: "studies", week: "digest" };
/** The two views' names, shown on the switch. */
export const VIEW_NAME = { read: "Read", data: "Data" } as const;
/** The switch's two words, the same on every page: on an object page "Terminal" is its Data view. */
export const MODE_NAME: Record<Mode, string> = { read: "Read", terminal: "Terminal" };
/** True when the address shows an object's Data view (or the indicators page's, which shares the model). */
export const isDataView = (pathname: string, search: Record<string, unknown> = {}) => search["view"] === "data" && (!!objectOf(pathname) || pathname === "/signals/leading");
/** Old terminal object views → the object's one address in its Data view, keeping every other parameter; null for section views. */
export function terminalObjectHref(raw: Record<string, unknown>): string | null {
  const s = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const view = resolveView(s("panel") ?? "today"), story = s("story"), trait = s("trait");
  const o: ObjectRef | null = view === "today" && story ? { type: "story", id: story } : view === "brief" && trait ? { type: "signal", id: trait } : view === "patterns" && trait ? { type: "pattern", id: trait } : null;
  if (!o) return null;
  // The terminal's own defaults (empty filter, default sort, first page) carry nothing.
  const rest = Object.fromEntries(Object.entries(raw).filter(([k, v]) => !["panel", "story", "trait"].includes(k) && v !== "" && v !== undefined && !(k === "sort" && v === "domain") && !(k === "desc" && (v === false || v === "false")) && !(k === "page" && (v === 0 || v === "0")) && !(k === "sector" && v === "all")));
  return dataHref(o, rest);
}
/** An in-app href in its one-address form: old `/library/<domain>` and terminal object links (stored in rows we never rewrite) become the
 *  object's Data view, keeping every other parameter; anything else is returned unchanged. */
export function canonicalHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const u = new URL(href, "http://x"), seg = u.pathname.split("/").filter(Boolean).map(decodeSeg), search = Object.fromEntries(u.searchParams);
  if (seg[0] === "library" && seg[1] && seg.length === 2) return `${dataHref({ type: "brand", id: seg[1] }, search)}${u.hash}`;
  if (u.pathname === "/terminal") { const o = terminalObjectHref(search); if (o) return `${o}${u.hash}`; }
  return href;
}
/** U1 · an old object address (`/library/<domain>`, a terminal or `/?panel=` object view) → its one address in the Data view, in one
 *  permanent hop before any page renders (the request handler answers it); null for every other address. */
export function movedObjectHref(pathname: string, search: Record<string, string>): string | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "library" && seg[1] && seg.length === 2) { const q = new URLSearchParams(search).toString(); return canonicalHref(`${pathname}${q ? `?${q}` : ""}`); }
  if (pathname === "/terminal" || (pathname === "/" && legacyTerminalSearch(search))) return terminalObjectHref(search);
  return null;
}
/** Which mode an address belongs to: the terminal, the old library record, or an object's Data view. */
export const modeOf = (pathname: string, search: Record<string, unknown> = {}): Mode => (pathname === "/terminal" || pathname.startsWith("/terminal/") || pathname.startsWith("/library/") || isDataView(pathname, search) ? "terminal" : "read");

/** Backtick / mode switch: the same object or section in the other mode, keeping the sector lens. */
export function toggleHref(pathname: string, search: Record<string, unknown> = {}): string {
  const sector = lensOf(search), seg = pathname.split("/").filter(Boolean).map(decodeSeg);
  // U1: on an object's address the other mode is the same address with `view=data` added or removed; nothing else changes.
  const obj = objectOf(pathname);
  if (obj) return search["view"] === "data" ? readHref(obj, search) : dataHref(obj, search);
  // W2: leading indicators keep one address; the switch moves between its Read view and its Data view.
  if (seg[0] === "signals" && seg[1] === "leading" && seg.length === 2) return search["view"] === "data" ? "/signals/leading" : "/signals/leading?view=data";
  if (modeOf(pathname, search) === "terminal") {
    if (seg[0] === "library" && seg[1]) return `${brandPath(seg[1])}${qs({ sector })}`;
    const objHref = terminalObjectHref(search);
    if (objHref) { const u = new URL(objHref, "http://x"); return toggleHref(u.pathname, Object.fromEntries(u.searchParams)); }
    const view = resolveView(search["panel"]), trait = typeof search["trait"] === "string" && search["trait"] ? (search["trait"] as string) : undefined;
    if (view === "today" && typeof search["story"] === "string" && search["story"]) return storyHref(search["story"] as string);
    if (trait) return `${view === "patterns" ? patternPath(trait) : signalPath(trait)}${qs({ sector })}`;
    if (view === "rebrands") return `/brands${qs({ tab: "moves", sector })}`;
    if (view === "ledger") return "/ledger";
    if (view === "audit") return "/audit/new";
    if (view === "morning") return "/morning";
    if (view === "sectors") return sector ? `/sectors/${enc(sector)}` : "/sectors";
    return `${sectionById(sectionOf(view)).read}${qs({ sector })}`;
  }
  const t = (v: ViewId, trait?: string) => terminalHref(v, { trait, sector });
  switch (seg[0]) {
    case undefined: return t("today");
    case "stories": return t("today");
    case "desk": return t("today");
    case "signals": return t("overview");
    case "trait": return seg[1] ? dataHref({ type: "signal", id: seg[1] }, { sector }) : t("overview");
    case "what-we-show": return t("overview");
    case "brands": return t(search["tab"] === "moves" ? "rebrands" : "library");
    case "patterns": return t("patterns");
    case "data": return t("studies");
    case "digest": case "chart": case "editions": return t("digest");
    case "morning": return t("morning");
    case "sectors": return terminalHref("sectors", { sector: seg[1] ?? sector });
    case "watch": return t("watch");
    case "audit": return t("audit");
    case "ledger": return t("ledger");
    case "tools": case "status": return t("watch");
    default: return t("today");
  }
}
// THE READ BAR (E3, U3) — the Read shell's one bar: the seven sections in the order SECTIONS gives them (Today, Signals, Brands,
// Patterns, Studies, Digest, Tools), then More, one menu holding the glossary and the pages that explain the newsroom. Tools sits in the
// bar from 1024 px (`wide`); below 1024 px the bar moves into the Menu sheet and Tools sits under More there. Addresses never change.
export type BarId = "today" | "signals" | "brands" | "patterns" | "studies" | "digest" | "tools";
const BAR_ID: Record<SectionId, BarId> = { live: "today", signals: "signals", brands: "brands", patterns: "patterns", studies: "studies", digest: "digest", tools: "tools" };
export const READ_BAR: readonly { id: BarId; label: string; href: string; wide?: true }[] = SECTIONS.map(s => ({ id: BAR_ID[s.id], label: s.label, href: s.read, ...(s.id === "tools" ? { wide: true as const } : {}) }));
/** U3 · the Read view's keys, as in the terminal: 1–7 open the seven sections' Read addresses; "/" goes to search: the page's own search
 *  field when it has one ("focus-search"), else the brand directory (its search field takes focus on arrival). Other keys: null (`?` and backtick are handled beside it). */
export function readKeyHref(key: string, pageHasSearch: boolean): string | "focus-search" | null {
  if (/^[1-7]$/.test(key)) return SECTIONS[Number(key) - 1]!.read;
  if (key === "/") return pageHasSearch ? "focus-search" : "/brands";
  return null;
}
/** The section a Read bar item opens (the number keys 1–7 follow this order). */
export const barSection = (id: BarId): SectionId => SECTIONS.find(s => BAR_ID[s.id] === id)!.id;
export const MORE_LABEL = "More";
export type MoreId = "tools" | "glossary" | "story-rules" | "what-we-show" | "rss";
/** The More menu. `href: null` opens the glossary overlay in place (the `?` key does the same). Tools is listed only below 1024 px
 *  (`narrow`), where the bar itself is in the Menu sheet. */
export const MORE_MENU: readonly { id: MoreId; label: string; href: string | null; narrow?: true }[] = [
  { id: "tools", label: "Tools", href: "/tools", narrow: true },
  { id: "glossary", label: "Glossary", href: null },
  { id: "story-rules", label: "What makes a story", href: "/what-we-show#ed-w-story" },
  { id: "what-we-show", label: "What we show and why", href: "/what-we-show" },
  { id: "rss", label: "RSS", href: "/morning/rss.xml" },
];
/** Which bar item a Read path lights up: a bar item, More (Tools and the explainer pages), or nothing. */
export function readBarOf(pathname: string): BarId | "more" | null {
  const s = pathname.split("/").filter(Boolean)[0];
  if (s === "what-we-show") return "more";
  const sec = readSectionOf(pathname);
  return sec ? BAR_ID[sec] : null;
}
/** The Read section a path belongs to (for the active nav item). */
export function readSectionOf(pathname: string): SectionId | null {
  const s = pathname.split("/").filter(Boolean)[0];
  if (!s || s === "stories" || s === "ambient") return "live";
  if (s === "data") return "studies";
  if (s === "signals" || s === "trait" || s === "what-we-show") return "signals";
  if (s === "brands") return "brands";
  if (s === "patterns" || s === "collections") return "patterns";
  if (["digest", "chart", "morning", "sectors", "editions"].includes(s)) return "digest";
  if (["tools", "status", "watch", "audit", "ledger", "desk", "welcome", "kit", "brand"].includes(s)) return "tools";
  return null;
}

// SURFACES — every route file, old panel, terminal tab, overlay and console command family.
export type Surface = { section: SectionId; mode: Mode | "both"; status: "shown" | "quiet"; note: string };
const S = (section: SectionId, mode: Surface["mode"], status: Surface["status"], note: string): Surface => ({ section, mode, status, note });
/** Keys: route files relative to src/routes without extension ("signals.$key"), "family/*" for route families, "panel:<id>", "overlay:<id>", "cmd:<verb>". */
export const SURFACES: Record<string, Surface> = {
  // Read pages
  "index": S("live", "read", "shown", "The live front page from the pure front model: ticker, lead, Moving now, the live column (polls /front.json), chart of the day, new on the scene, your sector, editions; ?format= and ?sector= filters. Old /?panel= links redirect to /terminal."),
  "ambient.index": S("live", "read", "quiet", "The studio board: a hands-off, full-screen board for a wall (dark, Loud). Scenes from one pure playlist (lead, newest stories, chart, a move, a collection, the day's figure, a study); polls /front.json; ?dwell=, ?sector=, ?scenes=. Gated."),
  "ambient.setup": S("live", "read", "quiet", "How to set up the studio board: the three URL settings, kiosk mode in plain words, whether this browser keeps the screen awake. Gated; linked from the front page footer and /tools."),
  "status_.launch": S("tools", "read", "quiet", "Launch readiness for the owner: each switch as set now, what turning it on would expose, and live yes/no pre-flight checks. Read-only, no controls; gated, linked from /status."),
  "front[.]json": S("live", "read", "quiet", "The front page's changeable parts as JSON (ETag, short private cache), polled about every minute; gated like the pages."),
  "stories.no.$number": S("live", "read", "quiet", "A story's permanent number (No. 47) redirects to its story page; killed stories' numbers lead nowhere."),
  "signals.index": S("signals", "read", "shown", "Headline signals ranked, dimension tabs, tier switch for the curious."),
  "signals.$key": S("signals", "read", "shown", "Signal object page (was the trait explainer)."),
  "signals.leading": S("signals", "read", "shown", "Leading indicators: npm installs, GitHub stars and Google Fonts risers by topic; Data view at ?view=data (same address)."),
  "data.index": S("studies", "read", "shown", "Studies home: heading, lead study, the three series with their numbered studies, the in-the-works shelf (drafts and adoption candidates with their wait and earliest date) and the brand tool row. Gated."),
  "data.$slug": S("studies", "read", "shown", "One study as an argument: headline block, opening, three to five scenes (sticky figure on wide screens; ?step= opens the scene holding that old step), what to do with it, limits, 01 Evidence, 02 Related. Gated."),
  "data.where-you-sit": S("studies", "read", "shown", "A tool, not a study (no number): one tracked brand (?brand=) in its sector field, its strip and the signals that set it apart. Gated."),
  "data.{$slug}[.]png": S("studies", "both", "quiet", "Study share image (Study No. N and the written headline); gated while DATA_STORIES_PUBLIC is false."),
  "data.embed.$slug": S("studies", "read", "quiet", "One step of a study as a standalone page (?step=); gated while DATA_STORIES_PUBLIC is false."),
  "stories.$id": S("live", "read", "shown", "Story object page: headline, facts with receipts, so-what with why-this-ran, related; backtick opens Terminal › Live › Today with it focused."),
  "desk": S("tools", "read", "quiet", "Editor's desk: today's queue (ran, held, killed) with scores and edit history; actions need the editor key, kept in memory for the tab."),
  "trait.$key": S("signals", "read", "quiet", "Redirects to /signals/<key>; kept so old links and share cards work."),
  "trait.{$key}[.]png": S("signals", "both", "quiet", "Signal share image (open for link previews); used by /signals pages too."),
  "what-we-show": S("signals", "read", "shown", "What we show and why, with Where things live from this registry."),
  "brands.index": S("brands", "read", "shown", "Searchable brand directory with sector filter and a Moves tab."),
  "brands.$domain": S("brands", "read", "shown", "Brand object page; links to its dense terminal record."),
  "library.$domain": S("brands", "terminal", "shown", "Dense brand record (Terminal view of a brand)."),
  "patterns.index": S("patterns", "read", "shown", "The pattern gallery: a wall of stored captures showing headline patterns, filters in the URL."),
  "collections.index": S("patterns", "read", "shown", "Numbered collections: saved gallery filters, live at 12 or more tiles."),
  "collections.$slug": S("patterns", "read", "shown", "One collection as a wall, paired with its study or signal."),
  "patterns.$key": S("patterns", "read", "shown", "Pattern object page: example brands as a grid, filterable by sector."),
  "digest.index": S("digest", "read", "shown", "Latest issue: the newest closed week with a published story (E5 edition model)."),
  "digest.$week": S("digest", "read", "shown", "One closed week's issue, assembled from its published stories; a week with no story has no issue."),
  "digest.archive": S("digest", "read", "shown", "Every issue by its written headline."),
  "digest.rss[.]xml": S("digest", "read", "quiet", "Digest RSS feed (gated)."),
  "digest.{$week}[.]png": S("digest", "both", "quiet", "Issue share image (open)."),
  "editions": S("digest", "read", "shown", "Editions index: the Morning Line (daily), the Digest (weekly) and sector reports (quarterly)."),
  "morning.index": S("digest", "read", "shown", "The Morning Line, today's edition (UTC day) with the archive."),
  "morning.$date": S("digest", "read", "shown", "One Morning Line edition; permanent once its UTC day ends."),
  "morning.rss[.]xml": S("digest", "read", "quiet", "Morning Line RSS feed (gated like the Digest feed)."),
  "sectors.index": S("digest", "read", "shown", "Sector reports index, covered sectors first."),
  "sectors.$sector": S("digest", "read", "shown", "State of a sector this quarter, with a print stylesheet."),
  "welcome": S("tools", "read", "quiet", "Private landing page (LANDING_PUBLIC = false); gated, linked from /tools only."),
  "chart.index": S("digest", "terminal", "quiet", "Chart of the week, latest (linked from Live and the Digest)."),
  "chart.$week": S("digest", "terminal", "quiet", "Chart of the week page."),
  "chart.{$week}[.]png": S("digest", "both", "quiet", "Chart share image (open)."),
  "chart.{$week}[.]svg": S("digest", "both", "quiet", "Chart vector image (open)."),
  "tools": S("tools", "read", "shown", "One page linking every ACT tool."),
  "brand.system": S("tools", "read", "quiet", "Brand › The system (U3): every design-system value by name with its Read and Data value and a live sample, every kit chart in both looks from one fixture, and the key map; gated like /brand."),
  "brand.index": S("tools", "read", "quiet", "The brand: overview of the approved slug brand (P · Extra Fine) built from the live tokens; gated while BRAND_PUBLIC is false, linked from /tools and /kit."),
  "brand.mark": S("tools", "read", "quiet", "Brand › The mark: construction, clear space, the three cuts, the s, tiles and app icon, grounds, what not to do."),
  "brand.colour": S("tools", "read", "quiet", "Brand › Colour: proportions, roles with hex, job and limit, live contrast from the tokens, stage colours, three modes."),
  "brand.type": S("tools", "read", "quiet", "Brand › Type: the role ladder set in real story copy, sizes read from the tokens, the four type rules."),
  "brand.containers": S("tools", "read", "quiet", "Brand › Containers: the eight, each with use for and never, the front page's container map, the rules."),
  "brand.space": S("tools", "read", "quiet", "Brand › Space: the scale, the three densities as annotated page skeletons, the rules."),
  "brand.illustration": S("tools", "read", "quiet", "Brand › Illustration: rules, then each of the three styles live (one per screen) with its filters and a replay button."),
  "brand.motion": S("tools", "read", "quiet", "Brand › Motion: rules, timings, easings, then each of the five patterns live with its tokens and a replay button."),
  "brand.downloads": S("tools", "read", "quiet", "Brand › Downloads: the kit files (logo SVG/PNG, tokens, motion CSS, filters, guidelines), served only through the gated file route."),
  "brand.files.$file": S("tools", "both", "quiet", "One kit file from brand/ (allow-listed names only); gated like any page, never an open path."),
  "kit": S("tools", "read", "quiet", "Design kit: every shared component on live data in the current theme, light/dark/vibes side by side; gated, linked from /tools only."),
  "status": S("tools", "read", "quiet", "Health, model card and ops details; out of the reader's path."),
  "audit.index": S("tools", "read", "shown", "Competitive audit."),
  "audit.new": S("tools", "read", "shown", "Start an audit."),
  "audit[.]png": S("tools", "both", "quiet", "Audit share card (open)."),
  "watch.$id": S("tools", "read", "shown", "A watchlist (capability link)."),
  "watch.new": S("tools", "read", "shown", "Create a watchlist."),
  "ledger": S("tools", "read", "shown", "Forecast ledger and hit rate."),
  "terminal": S("live", "terminal", "shown", "Terminal mode: the same six sections, dense, keyboard-first."),
  "embed.trait.$key": S("tools", "both", "quiet", "Embeddable signal widget (open)."),
  "embed.chart.$week": S("tools", "both", "quiet", "Embeddable chart widget (open)."),
  "robots[.]txt": S("tools", "both", "quiet", "Crawler instructions."),
  "thumbs.$": S("brands", "both", "quiet", "Credited homepage thumbnails."),
  "share.$": S("live", "both", "quiet", "Share cards (1200×630) for the front page, stories, brands, patterns, collections, the Morning Line and sector reports; gated until launch."),
  "crops.$": S("brands", "both", "quiet", "Credited section crops (hero, navigation, pricing, call to action, footer); gated like any page, never served for opted-out sites."),
  "api/public/mcp": S("tools", "both", "shown", "MCP endpoint (agent access); its tool count is MCP_TOOL_COUNT, checked against the registry."),
  "api/public/oembed": S("tools", "both", "quiet", "oEmbed provider for signal and chart pages."),
  "api/public/watch-feed.{$token}[.]xml": S("tools", "both", "quiet", "Per-watchlist RSS."),
  "api/public/health": S("tools", "both", "quiet", "Machine-readable health; shown in words on /status."),
  "api/public/*": S("tools", "both", "quiet", "Machine endpoints: cron callbacks, crawler/thumb/crop ingest, opt-out, MCP keys admin, editor desk, OAuth metadata."),
  // Old terminal panels and new tabs
  "panel:today": S("live", "terminal", "shown", "Live · Today (key T)."),
  "panel:wire": S("live", "terminal", "shown", "Live · Wire (old F8)."),
  "panel:overview": S("signals", "terminal", "shown", "Signals · All signals (old F1)."),
  "panel:type": S("signals", "terminal", "shown", "Signals · Type (old F2)."),
  "panel:color": S("signals", "terminal", "shown", "Signals · Color (old F3)."),
  "panel:layout": S("signals", "terminal", "shown", "Signals · Layout (old F4), with Composition as a sub-tab."),
  "panel:composition": S("signals", "terminal", "shown", "Signals · Layout › Composition (old F5)."),
  "panel:lexicon": S("signals", "terminal", "shown", "Signals · Voice (old F6 Lexicon)."),
  "panel:vibe": S("signals", "terminal", "shown", "Signals · Vibe map (old F7)."),
  "panel:brief": S("signals", "terminal", "shown", "Signals · Forecast: stage board, next wave, model card (old F10)."),
  "panel:library": S("brands", "terminal", "shown", "Brands · Directory (old F11 Library)."),
  "panel:rebrands": S("brands", "terminal", "shown", "Brands · Moves: rebrands and recent changes (old F9)."),
  "panel:history": S("brands", "terminal", "shown", "Brands · History (old F12)."),
  "panel:patterns": S("patterns", "terminal", "shown", "Patterns: dense pattern list."),
  "panel:studies": S("studies", "terminal", "shown", "Studies (F5): every study with its status, its live check and written text, each linking to its Data view."),
  "panel:digest": S("digest", "terminal", "shown", "Digest issues in terminal density (key D)."),
  "panel:morning": S("digest", "terminal", "shown", "Digest › Morning Line: today's edition in terminal density."),
  "panel:sectors": S("digest", "terminal", "shown", "Digest › Sector reports: sectors with coverage, opening each report."),
  "panel:watch": S("tools", "terminal", "shown", "Tools · Watch (key W)."),
  "panel:audit": S("tools", "terminal", "shown", "Tools · Audit launcher."),
  "panel:ledger": S("tools", "terminal", "shown", "Tools · Ledger summary."),
  "panel:console": S("tools", "terminal", "shown", "Tools · Console help."),
  // Overlays
  "overlay:glossary": S("tools", "both", "shown", "Glossary (?), in both modes."),
  "overlay:methodology": S("tools", "both", "shown", "Methodology (#m-…), in both modes."),
  "overlay:mcp": S("tools", "terminal", "shown", "MCP guide; linked from Tools."),
  "overlay:health": S("tools", "terminal", "quiet", "Health line in the terminal footer; details on /status. Never in the Read shell."),
  "overlay:tour": S("live", "both", "shown", "First-visit tour, once per mode per device."),
  // Console command families
  "cmd:today": S("live", "terminal", "shown", "Open Live · Today."),
  "cmd:signals": S("signals", "terminal", "shown", "Open Signals · All signals (also ticker)."),
  "cmd:tour": S("live", "terminal", "shown", "Restart the tour."),
  "cmd:glossary": S("tools", "terminal", "shown", "Open the glossary."),
  "cmd:digest": S("digest", "terminal", "shown", "Open the Digest."),
  "cmd:morning": S("digest", "terminal", "shown", "Today's Morning Line inline (morning <YYYY-MM-DD> for another day)."),
  "cmd:watch": S("tools", "terminal", "shown", "watch, watch new/add/rm/open."),
  "cmd:audit": S("tools", "terminal", "shown", "audit <sites>."),
  "cmd:ledger": S("tools", "terminal", "shown", "The live record inline."),
  "cmd:read": S("live", "terminal", "shown", "Switch to Read mode (same object)."),
  "cmd:type": S("tools", "terminal", "quiet", "Recommend type; offered in context on brand pages."),
  "cmd:palette": S("tools", "terminal", "quiet", "Recommend a palette."),
  "cmd:diff": S("tools", "terminal", "quiet", "Differentiate; offered on brand pages."),
  "cmd:critique": S("tools", "terminal", "quiet", "Critique a URL; audit pending sites link here."),
  "cmd:q": S("tools", "terminal", "quiet", "Query signals; 'Who uses this well' on signal pages."),
  "cmd:help": S("tools", "terminal", "shown", "List commands."),
};
// DENSITY — every route file's page density (brand/README.md, "Space"). The root shell writes it to <html data-density>.
// Quiet: stories, reports, long pages (one off-centre column, 104 above the title). Steady: the front page and indexes (40 between
// blocks, 16 inside). Loud: the terminal, tile walls, the kit (8 gaps). "none": routes that render no page (images, feeds, JSON, API).
export const DENSITIES = ["quiet", "steady", "loud"] as const;
export type Density = (typeof DENSITIES)[number];
export const DENSITY: Record<string, Density | "none"> = {
  index: "steady", "signals.index": "steady", "signals.leading": "steady", "brands.index": "steady", "patterns.index": "steady", "digest.archive": "steady", editions: "steady",
  "sectors.index": "steady", "data.index": "steady", tools: "steady", "audit.index": "quiet", "audit.new": "steady", "watch.$id": "steady", "watch.new": "steady",
  ledger: "steady", desk: "steady", status: "steady", "what-we-show": "steady", "brands.$domain": "steady", "patterns.$key": "steady", "collections.index": "steady", "collections.$slug": "steady", "morning.index": "quiet", "morning.$date": "quiet",
  "stories.$id": "quiet", "stories.no.$number": "quiet", "signals.$key": "quiet", "trait.$key": "quiet",
  "digest.index": "quiet", "digest.$week": "quiet", "sectors.$sector": "quiet", "data.$slug": "quiet", "data.where-you-sit": "quiet", welcome: "quiet",
  "brand.index": "quiet", "brand.mark": "quiet", "brand.colour": "quiet", "brand.type": "quiet", "brand.containers": "quiet", "brand.system": "quiet", "brand.space": "quiet",
  "brand.illustration": "quiet", "brand.motion": "quiet", "brand.downloads": "quiet",
  terminal: "loud", "library.$domain": "loud", "ambient.index": "loud", "ambient.setup": "steady", "status_.launch": "steady", "chart.index": "loud", "chart.$week": "loud", kit: "loud",
  "front[.]json": "none", "digest.rss[.]xml": "none", "digest.{$week}[.]png": "none", "morning.rss[.]xml": "none", "chart.{$week}[.]png": "none", "chart.{$week}[.]svg": "none",
  "audit[.]png": "none", "trait.{$key}[.]png": "none", "data.{$slug}[.]png": "none", "data.embed.$slug": "none", "embed.trait.$key": "none", "embed.chart.$week": "none",
  "robots[.]txt": "none", "thumbs.$": "none", "crops.$": "none", "share.$": "none", "brand.files.$file": "none", "api/*": "none",
};
/** Route file key for a router route id ("/data/$slug" → "data.$slug", "/" → "index", "/brand/" → "brand.index"). */
export const routeKeyOf = (routeId: string) => routeId === "/" ? "index" : routeId.replace(/^\//, "").replace(/\/$/, "/index").replace(/\//g, ".");
/** The page density for a matched route id; Steady when the route renders no page or is unknown. */
export function densityOf(routeId: string): Density {
  const d = DENSITY[routeKeyOf(routeId)];
  return d && d !== "none" ? d : "steady";
}
/** Density for a route file key ("api/public/mcp" falls back to "api/*"). */
export const densityOfFile = (key: string): Density | "none" | undefined => DENSITY[key] ?? (key.startsWith("api/") ? DENSITY["api/*"] : undefined);

/** Surface for a route file key, falling back to its "family/*" entry. */
export function surfaceOf(key: string): Surface | null {
  if (SURFACES[key]) return SURFACES[key]!;
  const fam = Object.keys(SURFACES).filter(k => k.endsWith("/*") && key.startsWith(k.slice(0, -1))).sort((a, b) => b.length - a.length)[0];
  return fam ? SURFACES[fam]! : null;
}
/** "Where things live" for /what-we-show: each section with its shown and quiet surfaces. */
export function whereThingsLive() {
  return SECTIONS.map(s => {
    const items = Object.entries(SURFACES).filter(([, v]) => v.section === s.id);
    return { ...s, shown: items.filter(([, v]) => v.status === "shown").map(([k, v]) => ({ key: k, ...v })), quiet: items.filter(([, v]) => v.status === "quiet").map(([k, v]) => ({ key: k, ...v })) };
  });
}

// SIGNAL INDEX TABS — /signals groups headline signals by dimension; Voice is the tone/positioning slice of VIBE (the old Lexicon panel's headline set).
export const SIGNAL_TABS = [
  { id: "all", label: "All" }, { id: "type", label: "Type" }, { id: "color", label: "Color" }, { id: "layout", label: "Layout" }, { id: "voice", label: "Voice" }, { id: "vibe", label: "Vibe" },
] as const;
export type SignalTab = (typeof SIGNAL_TABS)[number]["id"];
const VOICE = (k: string) => /^(tone|ai_positioning):/.test(k) || k === "combo:ai_forward" || k === "combo:playful_brand";
/** Which /signals tab a signal belongs to (besides All). */
export function signalTabOf(key: string, dimension: string): Exclude<SignalTab, "all"> {
  if (dimension === "FONT") return "type";
  if (dimension === "COLOR") return "color";
  if (dimension === "LAYOUT") return "layout";
  return VOICE(key) ? "voice" : "vibe";
}
export const resolveSignalTab = (v: unknown): SignalTab => (SIGNAL_TABS.some(t => t.id === v) ? (v as SignalTab) : "all");
