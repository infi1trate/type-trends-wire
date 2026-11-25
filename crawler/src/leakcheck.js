// slug leak check: brands that are still onboarding (in the seed list, read by the crawler, not yet in the panel) must not
// appear on any page a reader can open. Reads the live site's public pages from outside, the way a reader's browser would
// ask for them, and looks for each onboarding brand's page link, its pictures and its domain.
// Env: CRAWL_ENDPOINT + CRAWL_SECRET (to ask the site which brands are onboarding), SITE (default https://slug.global),
//      ONBOARDING_DOMAINS (comma list; skips the question, for tests), MAX_PAGES (default 90).
// Prints counts and paths only. Exit 1 when a leak is found, 0 otherwise (also when nothing is onboarding).
import { pathToFileURL } from "node:url";

export const SECTORS = ["ai", "dev-tools", "fintech", "consumer-apps", "commerce-dtc", "media", "studios", "hardware", "health", "enterprise-saas"];
export const FIXED = ["/", "/signals", "/brands", "/brands?view=data", "/boards", "/patterns", "/data", "/digest", "/morning", "/stories", "/terminal", "/kit",
  "/status", "/library", "/collections", "/crops", "/thumbs", "/compare", "/tools", "/watch", "/editions", "/sectors", "/colophon", "/what-we-show",
  "/digest.rss.xml", "/morning.rss.xml", ...SECTORS.map((s) => `/sectors/${s}`)];
// Sections whose own pages are worth following from their index (a handful each).
const FOLLOW = [/^\/signals\/[^"#?]+/, /^\/boards\/[^"#?]+/, /^\/stories\/[^"#?]+/, /^\/data\/[^"#?]+/, /^\/patterns\/[^"#?]+/, /^\/collections\/[^"#?]+/];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pure: what one page's text says about one onboarding domain. "link" and "picture" are leaks; "mention" is the bare
 *  domain somewhere else (a news item can name a company slug does not track yet), reported but not failed on. */
export function findings(text, domain) {
  const d = esc(domain), out = [];
  if (new RegExp(`/brands/${d}(?![a-z0-9.-])`, "i").test(text) || new RegExp(`/brands/${esc(encodeURIComponent(domain))}(?![a-z0-9.%-])`, "i").test(text)) out.push("link");
  // Stored pictures carry the brand's domain as a path segment (crops, thumbnails, pictures).
  if (new RegExp(`(?:src|srcset|href|content|url)\\s*[=:(]\\s*["']?[^"'\\s>)]*/(?:crops|thumbs|pictures|assets|site-crops|site-thumbs|brand-pictures)[^"'\\s>)]*/${d}/`, "i").test(text)) out.push("picture");
  if (!out.length && new RegExp(`(?<![a-z0-9.-])${d}(?![a-z0-9-]|\\.[a-z])`, "i").test(text)) out.push("mention");
  return out;
}

/** Pure: in-site links on a page that the check should also read, a few per section. */
export function follow(html, perSection = 6) {
  const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  const out = [];
  for (const re of FOLLOW) { const seen = new Set(); for (const h of hrefs) { const m = re.exec(h); if (m && !seen.has(m[0]) && seen.size < perSection) { seen.add(m[0]); out.push(m[0]); } } }
  return out;
}

async function onboardingDomains() {
  if (process.env.ONBOARDING_DOMAINS !== undefined) return process.env.ONBOARDING_DOMAINS.split(",").map((s) => s.trim()).filter(Boolean);
  const r = await fetch(new URL("library-state", process.env.CRAWL_ENDPOINT), { headers: { "x-crawl-secret": process.env.CRAWL_SECRET } });
  if (!r.ok) throw new Error(`library-state ${r.status}`);
  return ((await r.json()).sites ?? []).filter((s) => s.onboarding === true).map((s) => s.domain);
}

async function get(base, path) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(base + path, { headers: { "user-agent": "slug-leakcheck/1 (+https://slug.global; GitHub Actions)", accept: "text/html,application/xml;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(45000) });
      if (r.status >= 500 && attempt < 3) { await new Promise((s) => setTimeout(s, 4000 * attempt)); continue; }
      return { status: r.status, text: r.ok ? await r.text() : "" };
    } catch { if (attempt === 3) return { status: 0, text: "" }; await new Promise((s) => setTimeout(s, 4000 * attempt)); }
  }
  return { status: 0, text: "" };
}

async function main() {
  const base = (process.env.SITE ?? "https://slug.global").replace(/\/$/, ""), max = Number(process.env.MAX_PAGES ?? 90);
  const domains = await onboardingDomains();
  if (!domains.length) { console.log("no brand is onboarding: nothing to look for"); return; }
  const queue = [...FIXED], seen = new Set(queue), leaks = [], mentions = [];
  let read = 0, unread = 0;
  while (queue.length && read + unread < max) {
    const path = queue.shift(), r = await get(base, path);
    if (!r.text) { unread++; console.log(`${path}: not read (${r.status || "network"})`); continue; }
    read++;
    for (const h of follow(r.text)) if (!seen.has(h) && seen.size < max) { seen.add(h); queue.push(h); }
    for (const d of domains) for (const f of findings(r.text, d)) (f === "mention" ? mentions : leaks).push({ path, domain: d, kind: f });
    await new Promise((s) => setTimeout(s, 700));
  }
  // An onboarding brand's own address answers the way a brand slug does not track answers.
  const own = [];
  for (const d of domains.slice(0, 5)) { const r = await get(base, `/brands/${encodeURIComponent(d)}`); own.push(`${d} ${r.status}`); if (r.text && /"brand"|data-brand-page|<h1[^>]*>[^<]{1,60}<\/h1>/i.test(r.text) && new RegExp(`/(?:crops|thumbs|pictures)[^"']*/${esc(d)}/`, "i").test(r.text)) leaks.push({ path: `/brands/${d}`, domain: d, kind: "own page shows pictures" }); await new Promise((s) => setTimeout(s, 700)); }
  console.log(`looked for ${domains.length} onboarding brands on ${read} pages (${unread} not read); own pages: ${own.join(", ")}`);
  for (const m of mentions.slice(0, 20)) console.log(`mention (not a leak by itself): ${m.domain} on ${m.path}`);
  for (const l of leaks.slice(0, 60)) console.log(`LEAK ${l.kind}: ${l.domain} on ${l.path}`);
  console.log(leaks.length ? `${leaks.length} leaks` : "no onboarding brand is shown anywhere");
  if (leaks.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2); });
