// "Couldn't read the stored data just now" — a temporary failure, not a broken page. A server read that gives up marks its response with
// Retry-After; the server entry then answers such an HTML page 503 instead of 500, so caches and crawlers come back later.
export const RETRY_AFTER_S = 30;
export const UNAVAILABLE_BODY = "The stored captures took too long to read this time. Nothing is lost; the next try usually works.";

/** A 500 HTML page carrying Retry-After (set by a read that gave up) becomes 503 with the same body and headers; anything else passes. */
export function retryLater(res: Response): Response {
  if (res.status !== 500 || !res.headers.has("retry-after") || !(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  return new Response(res.body, { status: 503, statusText: "Service Unavailable", headers: res.headers });
}
