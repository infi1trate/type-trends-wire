// Shared-password site gate (pre-launch soft privacy, not account security).
// Runs in src/server.ts before any SSR, so locked visitors never receive page data or meta.
// Set SITE_PASSWORD_SHA256 to "" to switch the gate off; robots/noindex then revert too.
import { createRateLimiter } from "./mcp/rate-limit";

/** sha256 (lowercase hex) of the shared password. The plaintext is never stored. */
export const SITE_PASSWORD_SHA256: string = "1c8bfe8f801d79745c4631d09fff36c82aa37fc4cce4fc946683d7b336b63032";
export const GATE_ENABLED = SITE_PASSWORD_SHA256 !== "";

export const GATE_COOKIE = "dsgn_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30;
export const UNLOCK_BODY_LIMIT = 2048;
export const UNLOCK_ATTEMPTS = 10;
export const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

type OpenPath = { prefix?: string; exact?: string; pattern?: RegExp; why: string };

/** Everything here bypasses the gate. Everything else (every page route, RSS, server functions) is gated. */
export const OPEN_PATHS: readonly OpenPath[] = [
  { prefix: "/api/public/", why: "Machine endpoints that verify their own callers: cron callbacks, crawler/thumb ingest, thumb-optout, health, library-state, and the MCP endpoint (/api/public/mcp, incl. its trend://methodology resource) with its OAuth metadata." },
  // The one human-content endpoint outside the gate: per-watchlist RSS (already under /api/public/, listed here on purpose).
  // RSS readers can't send the password, so the unguessable 22-char feed token is the credential; the edit link rotates it and unknown tokens 404.
  { pattern: /^\/api\/public\/watch-feed\/[A-Za-z0-9_-]{22}\.xml$/, why: "Per-watchlist RSS alerts: a capability URL protected by its unguessable, rotatable feed token (no personal data, noindex)." },
  { pattern: /^\/chart\/[^/]+\.(png|svg)$/, why: "Chart-of-the-week share images, so link previews render." },
  { exact: "/audit.png", why: "Competitive-audit share card (domain names and capture date only), so link previews render." },
  { pattern: /^\/digest\/[^/]+\.png$/, why: "Digest issue OG images, so link previews render." },
  { pattern: /^\/trait\/[^/]+\.png$/, why: "Trait explainer OG images, so link previews render." },
  { prefix: "/thumbs/", why: "Credited homepage thumbnails (already public crops) referenced by share cards." },
  { prefix: "/assets/", why: "Hashed static JS/CSS build output; contains no stored data." },
  { exact: "/favicon.svg", why: "Browser tab icon." },
  { exact: "/robots.txt", why: "Crawler instructions (Disallow: / while the gate is on)." },
];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some(o =>
    (o.exact !== undefined && pathname === o.exact) ||
    (o.prefix !== undefined && pathname.startsWith(o.prefix)) ||
    (o.pattern !== undefined && o.pattern.test(pathname)));
}

/** Non-HTML gated paths answer with plain 401 text instead of the gate page. */
const TEXT_LOCKED = (p: string) => p === "/digest/rss.xml" || p.startsWith("/_serverFn");

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Constant-time string equality (length leak only, and all compared values are 64-char hex). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Cookie value; derived from the hash so changing the password invalidates old cookies. */
export const gateToken = (hash: string) => sha256Hex(`${hash}:dsgn-gate-v1`);

/** Only same-origin relative paths; anything else becomes "/". */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length > 1024) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  return next;
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

export function renderGatePage(next: string, wrong = false): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>DSGN/TERMINAL</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:#000;color:#fff;font:400 13px/1.5 "Geist Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;display:flex;flex-direction:column}
header,footer{display:flex;align-items:center;min-height:24px;padding:0 12px;border-bottom:1px solid #262626;background:#0e0e0e;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
footer{border-bottom:0;border-top:1px solid #262626;color:#6b6b6b;margin-top:auto}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 12px}
form{width:100%;max-width:360px;display:grid;gap:8px}
h1{font-size:20px;font-weight:600;letter-spacing:.02em;margin-bottom:16px}
label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.row{display:flex;gap:0}
input{flex:1;min-width:0;height:44px;padding:0 12px;background:#000;color:#fff;border:1px solid #6b6b6b;border-radius:0;font:inherit;font-size:13px}
button{height:44px;min-width:88px;padding:0 16px;background:#fff;color:#000;border:1px solid #fff;border-left:0;border-radius:0;font:inherit;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
input:focus-visible,button:focus-visible{outline:1px solid #fff;outline-offset:2px}
.msg{min-height:20px;font-size:13px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>
<header>DSGN/TERMINAL</header>
<main>
<form method="post" action="/unlock">
<h1>DSGN/TERMINAL</h1>
<label for="password">Password</label>
<div class="row">
<input id="password" name="password" type="password" autocomplete="current-password" required autofocus${wrong ? ' aria-invalid="true" aria-describedby="gate-msg"' : ""}>
<button type="submit">Enter</button>
</div>
<input type="hidden" name="next" value="${esc(next)}">
<p id="gate-msg" class="msg" role="status" aria-live="polite">${wrong ? "That's not it." : ""}</p>
</form>
</main>
<footer>Private preview</footer>
</body>
</html>`;
}

const gatePage = (next: string, wrong = false) =>
  new Response(renderGatePage(next, wrong), { status: 401, headers: { "content-type": "text/html; charset=utf-8", ...NO_STORE } });
const text = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...NO_STORE, ...extra } });

async function boundedForm(request: Request): Promise<URLSearchParams | null> {
  if (Number(request.headers.get("content-length") ?? 0) > UNLOCK_BODY_LIMIT) return null;
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > UNLOCK_BODY_LIMIT) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new URLSearchParams(new TextDecoder().decode(all));
}

export type GateConfig = { hash: string; allow: (ip: string, now?: number) => boolean };
const defaultConfig: GateConfig = { hash: SITE_PASSWORD_SHA256, allow: createRateLimiter(UNLOCK_ATTEMPTS, UNLOCK_WINDOW_MS) };

const clientIp = (r: Request) => r.headers.get("cf-connecting-ip") ?? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** Returns a Response when the gate answers the request, or null to let the app handle it. */
export async function gate(request: Request, cfg: GateConfig = defaultConfig): Promise<Response | null> {
  if (!cfg.hash) return null;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/lock") {
    const headers: Record<string, string> = { location: "/", ...NO_STORE };
    if (request.method === "POST") headers["set-cookie"] = `${GATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
    return new Response(null, { status: 303, headers });
  }

  if (path === "/unlock") {
    if (request.method !== "POST") return gatePage(safeNext(url.searchParams.get("next")));
    if (!cfg.allow(clientIp(request))) return text(429, "Too many attempts. Try again in 10 minutes.", { "retry-after": String(UNLOCK_WINDOW_MS / 1000) });
    const form = await boundedForm(request);
    if (!form) return text(413, "Request too large.");
    const next = safeNext(form.get("next"));
    const ok = safeEqual(await sha256Hex(form.get("password") ?? ""), cfg.hash);
    if (!ok) return gatePage(next, true);
    return new Response(null, {
      status: 303,
      headers: {
        location: next,
        "set-cookie": `${GATE_COOKIE}=${await gateToken(cfg.hash)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${GATE_MAX_AGE}`,
        ...NO_STORE,
      },
    });
  }

  if (isOpenPath(path)) return null;
  const cookie = readCookie(request, GATE_COOKIE);
  if (cookie && safeEqual(cookie, await gateToken(cfg.hash))) return null;
  if (TEXT_LOCKED(path)) return text(401, "Locked. This site is password-protected.");
  return gatePage(safeNext(path + url.search));
}

export const ROBOTS_LOCKED = "User-agent: *\nDisallow: /\n";
export const ROBOTS_OPEN = ["Googlebot", "Bingbot", "Twitterbot", "facebookexternalhit", "*"].map(a => `User-agent: ${a}\nAllow: /\n`).join("\n");
export const robotsTxt = (hash = SITE_PASSWORD_SHA256) => (hash ? ROBOTS_LOCKED : ROBOTS_OPEN);
