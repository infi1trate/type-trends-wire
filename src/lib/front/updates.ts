// /front.json: the front model's changeable parts as JSON with a content ETag (ignoring the clock) and a short private cache. Pure apart from
// Web Crypto. The route is gated like every page (it is not under /api/public/), so locked visitors never receive it.
import type { FrontUpdates } from "./front";

export const UPDATES_PATH = "/front.json";
export const UPDATES_CACHE = "private, max-age=30";
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join("");
}
/** A weak ETag over everything except `now`, so an unchanged front answers 304 between polls. */
export async function updatesEtag(u: FrontUpdates): Promise<string> { const { now: _now, ...rest } = u; return `W/"${await sha(JSON.stringify(rest))}"`; }
const matches = (header: string | null, etag: string) => !!header && header.split(",").map(x => x.trim()).some(x => x === etag || x === "*" || x.replace(/^W\//, "") === etag.replace(/^W\//, ""));
export async function updatesResponse(u: FrontUpdates, ifNoneMatch: string | null): Promise<Response> {
  const etag = await updatesEtag(u), headers = { ETag: etag, "Cache-Control": UPDATES_CACHE, Vary: "Cookie" };
  if (matches(ifNoneMatch, etag)) return new Response(null, { status: 304, headers });
  return new Response(JSON.stringify(u), { status: 200, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
