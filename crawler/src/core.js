// Shared by the index crawl (crawl.js) and the library crawl (library.js).
import { mkdirSync, appendFileSync } from "node:fs";
import { extractInPage } from "./extract-page.js";
import { paletteFromScreenshot, pickAccent, parseCssColor, contrast, rgbToHex } from "./color.js";
import { homepageAllowed } from "./robots.js";
import { resolveFonts } from "./fonts.js";

export const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 DSGNTerminalBot/0.1 (+https://type-trends-wire.lovable.app)";
export const UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 DSGNTerminalBot/0.1 (+https://type-trends-wire.lovable.app)";
export const VIEWPORTS = {
  desktop: { userAgent: UA, viewport: { width: 1440, height: 900 } },
  mobile: { userAgent: UA_MOBILE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

// Second line of defence after the seed blocklists: what the page says about itself.
export const ADULT_TEXT = /\b(porn\w*|xxx|sex(y|ual)? ?(video|cam|chat|movie|story|stories)|nude|naked|nsfw|hentai|escorts?|milf|onlyfans|cam ?girls?|erotic\w*|adult (video|content|site)|jav\b|fetish|hookup)\b|色情|成人|アダルト|야동/i;
export const GAMBLING_TEXT = /\b(casino|online slots|slot machines?|sportsbook|betting|bet now|lottery|jackpot|satta|matka|togel|judi)\b|博彩|彩票|娱乐城|bóng đá|xổ số/i;

export function makePoster({ endpoint, secret, dry, runId }) {
  return async function post(body) {
    if (dry) { mkdirSync("out", { recursive: true }); appendFileSync(`out/${runId}.jsonl`, JSON.stringify(body) + "\n"); return {}; }
    for (let attempt = 1; attempt <= 4; attempt++) {
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": secret }, body: JSON.stringify(body) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (r.ok) return r.json().catch(() => ({}));
      const msg = await r.text();
      if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new Error(`ingest rejected (${r.status}): ${msg.slice(0, 300)}`);
      await new Promise((s) => setTimeout(s, attempt * 3000));
    }
    throw new Error("ingest failed after 4 attempts");
  };
}

/** Fonts the browser actually rendered (not the CSS stack), via CDP, per role. */
export async function renderedFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const roles = { h1: "[data-dsgn-headline], [data-dsgn-headline] *", h2: "h2, h2 *", body: "main p, article p, p", nav: "header a, nav a", cta: "button, a[class*=button], a[class*=btn]" };
  const out = {};
  for (const [role, sel] of Object.entries(roles)) {
    try {
      const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: sel });
      const counts = new Map();
      for (const nodeId of nodeIds.slice(0, 12)) {
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }).catch(() => ({ fonts: [] }));
        for (const f of fonts) {
          if (/emoji|symbol/i.test(f.familyName)) continue; // emoji glyphs in a headline are not its typeface
          const c = counts.get(f.familyName) ?? { glyphs: 0, custom: f.isCustomFont };
          c.glyphs += f.glyphCount; counts.set(f.familyName, c);
        }
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1].glyphs - a[1].glyphs);
      if (ranked.length) out[role] = { raw: ranked[0][0], glyphs: ranked[0][1].glyphs, webfont: !!ranked[0][1].custom, also: ranked.slice(1, 3).map(([f]) => f) };
    } catch { /* selector absent */ }
  }
  await cdp.detach().catch(() => {});
  return out;
}

export async function robotsOk(origin, path = "/") {
  try {
    const r = await fetch(origin + "/robots.txt", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(6000) });
    return r.ok ? homepageAllowed(await r.text(), undefined, path) : true;
  } catch { return true; }
}

export function errorCode(e) {
  const msg = String(e?.message || e);
  return /net::(ERR_[A-Z_]+)/.exec(msg)?.[1] ?? (/Timeout/i.test(msg) ? "timeout" : msg.split("\n")[0].replace(/https?:\S+/g, "").slice(0, 80));
}

/** Navigate and settle. Returns null on success or an error code. */
export async function openPage(page, url) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  if (!res || res.status() >= 400) return `http_${res?.status() ?? "none"}`;
  if (!(res.headers()["content-type"] ?? "").includes("html")) return "not_html";
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(1200);
  // Late webfonts: give any still-loading faces up to 3s more, so a fallback isn't recorded as the design.
  await page.evaluate(async () => {
    const t0 = Date.now();
    while (document.fonts && [...document.fonts].some((f) => f.status === "loading") && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 150));
  }).catch(() => {});
  await hideOverlays(page);
  return null;
}

/** Hide cookie/consent banners and modal overlays so they don't count as the page's colors or headline. */
export async function hideOverlays(page) {
  await page.evaluate(() => {
    const sel = "#onetrust-consent-sdk, #onetrust-banner-sdk, #CybotCookiebotDialog, #usercentrics-root, #truste-consent-track, .truste_box_overlay, #didomi-host, .didomi-popup, #cookie-law-info-bar, .cc-window, .cky-consent-container, [id*=cookie-banner i], [class*=cookie-banner i], [id*=cookie-consent i], [class*=cookie-consent i], [class*=consent-banner i], [aria-modal=true]";
    for (const e of document.querySelectorAll(sel)) e.style.setProperty("display", "none", "important");
    const re = /cookie|consent|privacy (choices|preferences|settings)|we use (cookies|technologies)/i;
    for (const e of document.querySelectorAll("body *")) {
      const s = getComputedStyle(e);
      if (s.position !== "fixed" && s.position !== "sticky") continue;
      if (e.matches("header, nav, [role=banner], [role=navigation]")) continue;
      if (re.test((e.innerText || "").slice(0, 600))) e.style.setProperty("display", "none", "important");
    }
  }).catch(() => {});
}

/** Evaluate an in-page function, retrying once if a client-side redirect destroys the context. */
export async function evalSettled(page, fn) {
  try { return await page.evaluate(fn); }
  catch (e) {
    if (!/context was destroyed|navigat/i.test(String(e))) throw e;
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return page.evaluate(fn);
  }
}

/** Design signals for an already-open page. Returns { ok:false, error } or { ok:true, ...fields }. */
export async function analyzePage(page, { started = Date.now() } = {}) {
  const signals = await evalSettled(page, extractInPage);
  if (signals.adult) return { ok: false, error: "adult" };
  // Title + meta description only: news homepages carry headlines about anything.
  const text = `${signals.title} ${signals.lexicon.description ?? ""}`;
  if (ADULT_TEXT.test(text)) return { ok: false, error: "adult" };
  if (GAMBLING_TEXT.test(text)) return { ok: false, error: "gambling" };
  const fonts = resolveFonts(await renderedFonts(page), signals.type_declared);
  const { width, height } = page.viewportSize();
  const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  const bg = parseCssColor(signals.colors_declared.page_bg);
  const pal = await paletteFromScreenshot(shot, bg);
  const fg = parseCssColor(signals.colors_declared.body_text);
  return {
    ok: true, final_url: page.url(),
    title: signals.title, lang: signals.lang,
    type: { rendered: fonts, declared: signals.type_declared },
    color: { ...pal, page_bg: bg ? rgbToHex(bg) : null, accent: pickAccent(signals.colors_declared.cta_bgs, pal.palette), body_contrast: bg && fg ? contrast(bg, fg) : null },
    layout: signals.layout,
    composition: { ...signals.composition, whitespace_ratio: pal.whitespace_ratio },
    lexicon: signals.lexicon,
    tech: { ...signals.tech, load_ms: Date.now() - started },
  };
}
