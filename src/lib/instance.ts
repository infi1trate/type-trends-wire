// C1 Part 1 · how old the answering server instance is, sent on every page response (`x-instance-age`, seconds) so an outside measure
// can say whether it met a cold instance. Pure and dependency-free. The hosted runtime freezes the clock while code runs and reads 0
// at module load, so the instance's start is the time of its first request, not of its module load; `x-instance-requests` counts the
// requests it has answered including this one (1 = the first request this instance ever saw).
export const INSTANCE_AGE_HEADER = "x-instance-age";
export const INSTANCE_REQUESTS_HEADER = "x-instance-requests";

export type InstanceClock = { seen(now?: number): { age_s: number; requests: number } };
export function instanceClock(): InstanceClock {
  let first = 0, n = 0;
  return {
    seen(now = Date.now()) {
      if (!first || first > now) first = now;
      n++;
      return { age_s: Math.max(0, Math.floor((now - first) / 1000)), requests: n };
    },
  };
}
/** The same response with the two headers set (a copy when the response's headers are read-only, as a fetched response's are). */
export function withInstanceHeaders(res: Response, seen: { age_s: number; requests: number }): Response {
  const set = (h: Headers) => { h.set(INSTANCE_AGE_HEADER, String(seen.age_s)); h.set(INSTANCE_REQUESTS_HEADER, String(seen.requests)); };
  try { set(res.headers); return res; } catch {
    const copy = new Response(res.body, { status: res.status, statusText: res.statusText, headers: new Headers(res.headers) });
    set(copy.headers);
    return copy;
  }
}
