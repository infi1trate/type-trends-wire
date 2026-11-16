// "Couldn't read the stored data just now" — a temporary failure, not a broken page. A gallery route whose loader gave up (after its
// retry) marks its page Retry-After through the route's `headers`; the server entry then answers that HTML page 503 instead of 500.
export const RETRY_AFTER_S = 30;
export const UNAVAILABLE_BODY = "The stored captures took too long to read this time. Nothing is lost; the next try usually works.";

/** A 500 HTML page carrying Retry-After (set by a read that gave up) becomes 503 with the same body and headers; anything else passes. */
export function retryLater(res: Response): Response {
  if (res.status !== 500 || !res.headers.has("retry-after") || !(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  return new Response(res.body, { status: 503, statusText: "Service Unavailable", headers: res.headers });
}
/** Route `headers` for pages whose only failure mode is a stored-data read: an errored match asks the client to retry later. */
export const retryHeaders = ({ match }: { match: { status: string } }): Record<string, string> | undefined =>
  match.status === "error" ? { "Retry-After": String(RETRY_AFTER_S) } : undefined;
