// Curated-index seeds: the sites design galleries are featuring right now. Galleries have no APIs, so we render one
// listing page per gallery (robots.txt checked, one page each, a pause between galleries) and keep only the outbound
// links to featured sites. We store domains and which galleries featured them, never the galleries' images or text.
import { robotsOk, UA } from "./core.js";
import { hostOf, registrable } from "./seeds.js";

// Godly was dropped (Nov 2026): it became a feed of social posts with no outbound site links.
export const GALLERIES = [
  { slug: "landbook", urls: ["https://land-book.com/", "https://land-book.com/?page=2"] },
  { slug: "awwwards", urls: ["https://www.awwwards.com/websites/sites_of_the_day/"] },
  { slug: "minimalgallery", urls: ["https://minimal.gallery/", "https://minimal.gallery/page/2/"] },
  { slug: "onepagelove", urls: ["https://onepagelove.com/", "https://onepagelove.com/page/2"] },
  { slug: "cssda", urls: ["https://www.cssdesignawards.com/website-gallery", "https://www.cssdesignawards.com/website-gallery?page=2"] },
  { slug: "saaslandingpage", urls: ["https://saaslandingpage.com/", "https://saaslandingpage.com/page/2/"] },
];

// Gallery chrome, sponsors, builders' referral links, socials and asset hosts: not featured sites.
const NOT_FEATURED = /(^|\.)(twitter\.com|x\.com|instagram\.com|facebook\.com|linkedin\.com|youtube\.com|youtu\.be|pinterest\.\w+|tiktok\.com|threads\.net|bsky\.app|discord\.(gg|com)|medium\.com|substack\.com|dribbble\.com|behance\.net|github\.com|google\.\w+|apple\.com|cloudflare\.com|gstatic\.com|googleapis\.com|wp\.com|wordpress\.(com|org)|w\.org|gmpg\.org|gravatar\.com|plausible\.io|pxf\.io|impact\.com|sjv\.io|mobbin\.com|vercel\.link|framer\.link|try\.webflow\.com|webflow\.com|framer\.com|readymag\.com|wix\.com|squarespace\.com|shopify\.com|carrd\.co|unicorn\.studio|saasinterface\.com|boardui\.com|lapa\.ninja|recent\.design|godly\.website|land-book\.com|awwwards\.com|minimal\.gallery|onepagelove\.com|cssdesignawards\.com|saaslandingpage\.com|creativemarket\.com|envato\.com|themeforest\.net|ui8\.net|gumroad\.com|lemonsqueezy\.com|paypal\.com|patreon\.com|buymeacoffee\.com|ko-fi\.com|typekit\.net|fonts\.\w+)$/i;
// Free staging subdomains are fine as sites, but keep the full host (not the platform's registrable domain).
const STAGING = /\.(webflow\.io|framer\.(website|app|ai)|vercel\.app|netlify\.app|pages\.dev|github\.io)$/i;

/** Normalize a featured link to the domain we crawl, or null if it isn't a featured site. */
export function featuredDomain(href, galleryHost) {
  const h = hostOf(href);
  if (!h || !h.includes(".")) return null;
  if (h === galleryHost || h.endsWith("." + galleryHost)) return null;
  if (NOT_FEATURED.test(h)) return null;
  return STAGING.test(h) ? h : registrable(h);
}

/** Featured domains from a list of hrefs, in page order, deduped. */
export function extractFeatured(hrefs, galleryUrl) {
  const galleryHost = registrable(hostOf(galleryUrl));
  const out = [];
  for (const href of hrefs) {
    const d = featuredDomain(href, galleryHost);
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Render each gallery's first listing pages; returns Map<domain, Set<gallery slug>> plus per-gallery stats. */
export async function galleryDomains(browser, { galleries = GALLERIES, perPage = 60, pauseMs = 3000 } = {}) {
  const found = new Map(), stats = {};
  for (const g of galleries) {
    let n = 0;
    for (const url of g.urls) {
      const u = new URL(url);
      if (!(await robotsOk(u.origin, u.pathname + u.search))) { stats[g.slug] = "robots_disallow"; break; }
      const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: "en-US" });
      const page = await context.newPage();
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (!res || res.status() >= 400) { stats[g.slug] = n || `http_${res?.status() ?? "none"}`; break; }
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        // Lazy grids: scroll a few screens so the first batch of cards renders.
        for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(600); }
        const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
        for (const d of extractFeatured(hrefs, url).slice(0, perPage)) {
          if (!found.has(d)) found.set(d, new Set());
          if (!found.get(d).has(g.slug)) n++;
          found.get(d).add(g.slug);
        }
        stats[g.slug] = n;
      } catch (e) {
        stats[g.slug] = n || String(e?.message ?? e).split("\n")[0].slice(0, 60);
        break;
      } finally {
        await context.close().catch(() => {});
      }
      await sleep(pauseMs);
    }
  }
  return { found, stats };
}
