// Pure helpers for library mode: list parsing, page discovery, hashing. No browser, no network.
import { createHash } from "node:crypto";

export const SECTORS = ["ai", "dev-tools", "fintech", "consumer-apps", "commerce-dtc", "media", "studios", "hardware", "health", "enterprise-saas"];
export const PAGE_TYPES = ["home", "pricing", "changelog", "product", "about"];

export function parseLibrary(csv) {
  const rows = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(",").map((s) => s.trim())).filter((r) => r[0]);
  for (const [d, s] of rows) if (!SECTORS.includes(s)) throw new Error(`unknown sector "${s}" for ${d}`);
  return rows.map(([domain, sector, name]) => ({ domain: domain.toLowerCase().replace(/^www\./, ""), sector, ...(name ? { name } : {}) }));
}

const RULES = {
  pricing: { path: /^\/(pricing|plans|price|prices|subscribe|membership)(\/|$)/i, text: /^(pricing|plans|plans & pricing|plans and pricing)$/i },
  changelog: { path: /^\/(changelog|change-log|releases|release-notes|whats-new|what-s-new|updates|new)(\/|$)/i, text: /^(changelog|what'?s new|release notes|updates)$/i },
  product: { path: /^\/(product|products|features|platform|overview|how-it-works)(\/|$)/i, text: /^(product|products|features|platform|overview|how it works)$/i },
  about: { path: /^\/(about|about-us|company|our-story|story|mission)(\/|$)/i, text: /^(about|about us|company|our story|mission)$/i },
};

/** Pick one URL per page type from a page's same-site links. Nav links win, then shortest path. */
export function discoverPages(links, homeUrl) {
  const home = new URL(homeUrl);
  const out = {};
  for (const [type, rule] of Object.entries(RULES)) {
    const cands = [];
    for (const l of links) {
      let u; try { u = new URL(l.href); } catch { continue; }
      if (u.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue; // same host only: docs./app. subdomains are other products
      const path = u.pathname.replace(/\/+$/, "") || "/";
      if (path === "/" || path.split("/").length > 3) continue;
      if (rule.path.test(path) || rule.text.test(l.text ?? "")) cands.push({ url: u.origin + path, nav: !!l.in_nav, len: path.length, byPath: rule.path.test(path) });
    }
    cands.sort((a, b) => (b.byPath - a.byPath) || (b.nav - a.nav) || (a.len - b.len));
    if (cands[0]) out[type] = cands[0].url;
  }
  return out;
}

export const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** Hash of server HTML with volatile parts removed (scripts, styles, nonces, tokens, whitespace). */
export function htmlHash(html) {
  if (!html) return null;
  const norm = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\s(nonce|integrity|data-[\w-]*(id|token|nonce|build|hash|ts)[\w-]*|csrf[\w-]*)="[^"]*"/gi, "")
    .replace(/[a-f0-9]{16,}|[A-Za-z0-9_-]{32,}/g, "~")
    .replace(/\b\d{10,13}\b/g, "~")
    .replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  return sha(norm);
}

/** Hash of rendered visible text. Lowercased, whitespace-collapsed; keeps digits (prices matter). */
export function contentHash(text) {
  if (!text) return null;
  return sha(text.toLowerCase().replace(/\s+/g, " ").trim());
}

const FRAMEWORKS = ["next", "nuxt", "framer", "webflow", "wordpress", "shopify", "squarespace", "wix", "astro", "gatsby", "sveltekit"];
/** Hash of the signals change detection looks at, so "nothing design-relevant moved" is one comparison. */
export function signalsHash(s) {
  const pick = {
    h1: s.type?.rendered?.h1?.family ?? null, body: s.type?.rendered?.body?.family ?? null,
    theme: s.color?.theme ?? null, accent: s.color?.accent ?? null,
    hero: s.layout?.hero_media ?? null, align: s.layout?.h1_align ?? null, cols: s.layout?.grid_max_cols ?? null,
    radius: s.layout?.cta_radius_px ?? null, h1text: s.lexicon?.h1 ?? null,
    nav: (s.nav ?? []).filter((n) => n.depth === 1).map((n) => n.label.toLowerCase()).sort(),
    css: [...(s.css_features ?? [])].sort(),
    fw: FRAMEWORKS.filter((f) => s.tech?.[f]),
  };
  return sha(JSON.stringify(pick));
}

// ---- Wayback ----
/** "20230401123456" → ISO string (UTC). */
export function waybackIso(ts) {
  const t = ts.padEnd(14, "0");
  return new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10), +t.slice(10, 12), +t.slice(12, 14))).toISOString();
}

/** Half-year buckets from fromYear H1 up to (not including) the half-year containing `now`. */
export function halfYearBuckets(fromYear, now = new Date()) {
  const out = [];
  for (let y = fromYear; y <= now.getUTCFullYear(); y++) for (const h of [0, 1]) {
    const start = Date.UTC(y, h * 6, 1), end = Date.UTC(y, h * 6 + 6, 1);
    if (end > now.getTime()) return out; // current half-year belongs to live crawls
    out.push({ key: `${y}H${h + 1}`, start, end, mid: Date.UTC(y, h * 6 + 3, 1) });
  }
  return out;
}

/** From CDX JSON rows ([header, [timestamp, original, statuscode], ...]) pick one 200 capture per half-year,
 *  the one closest to the bucket's midpoint. Skips timestamps already captured (ISO strings in `have`). */
export function pickCaptures(rows, { fromYear = 2021, now = new Date(), have = [] } = {}) {
  const body = (rows ?? []).slice(rows?.[0]?.[0] === "timestamp" ? 1 : 0).filter((r) => r && /^\d{8,14}$/.test(r[0]) && (r[2] === undefined || r[2] === "200"));
  const haveSet = new Set(have.map((h) => new Date(h).toISOString()));
  const picks = [];
  for (const b of halfYearBuckets(fromYear, now)) {
    let best = null;
    for (const r of body) {
      const t = Date.parse(waybackIso(r[0]));
      if (t < b.start || t >= b.end) continue;
      const d = Math.abs(t - b.mid);
      if (!best || d < best.d) best = { d, timestamp: r[0], original: r[1] };
    }
    if (!best) continue;
    const iso = waybackIso(best.timestamp);
    if (haveSet.has(iso) || [...haveSet].some((h) => Date.parse(h) >= b.start && Date.parse(h) < b.end)) continue; // bucket already filled
    picks.push({ bucket: b.key, timestamp: best.timestamp, original: best.original, iso });
  }
  return picks;
}
