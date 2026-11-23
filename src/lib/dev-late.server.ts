// P2c · DEV ONLY: reproduce a cold instance's late reads on the dev server. `?__late=<ms>` on a page address holds each read below for
// that long plus its own offset (so with 2000 the front page's reads land between 2 and 4 s, in this order), and `__late_only=a,b`
// holds only the reads named. The live build drops the body (`import.meta.env.DEV` is false there), so nothing on the site waits.
export const LATE_OFFSETS_MS: Readonly<Record<string, number>> = { "front-top": 0, "front-rest": 500, "front-also": 1000, "front-tape": 1500, "front-wire": 2000, brands: 0 };
export const LATE_MAX_MS = 600_000;
export async function devLate(read: string): Promise<void> {
  if (!import.meta.env.DEV) return;
  let url: URL;
  try { const { getRequest } = await import("@tanstack/react-start/server"); url = new URL(getRequest().url); } catch { return; }
  const base = Number(url.searchParams.get("__late") ?? 0);
  if (!Number.isFinite(base) || base <= 0) return;
  const only = url.searchParams.get("__late_only");
  if (only && !only.split(",").includes(read)) return;
  await new Promise(r => setTimeout(r, Math.min(LATE_MAX_MS, base + (LATE_OFFSETS_MS[read] ?? 0))));
}
/** DEV ONLY: `?__fail=checks` on a page address makes the change-check read fail for that request, the way it can on a fresh instance
 *  under load (the stored /brands record of 22 Nov, 17:31 UTC, holds exactly that result). */
export async function devFail(read: string): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  try { const { getRequest } = await import("@tanstack/react-start/server"); return (new URL(getRequest().url).searchParams.get("__fail") ?? "").split(",").includes(read); }
  catch { return false; }
}
/** D1 · DEV ONLY: `?__dbdown=1` on a request makes the database guard read "not answering" for it (the rehearsal of readers on their
 *  last good copies); the live build never reads it. */
export async function devDbDown(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  try { const { getRequest } = await import("@tanstack/react-start/server"); return new URL(getRequest().url).searchParams.get("__dbdown") === "1"; }
  catch { return false; }
}
/** PH1 · DEV ONLY: `?__launches=1` on a page address (or the page a server call comes from) adds three invented Product Hunt launches,
 *  published, to the stories the front page's side column and the Terminal's list read, for proof pictures. Nothing is stored. */
export const SAMPLE_LAUNCHES = [
  { name: "Kernwise", tagline: "Spacing and kerning checks for web type", votes: 412 },
  { name: "Swatchroom", tagline: "Shared colour tokens for design and code", votes: 268 },
  { name: "Pagecraft", tagline: "A website builder that exports clean HTML", votes: 171 },
] as const;
export async function devSampleLaunches<T extends { id: string; state: string }>(all: T[]): Promise<T[]> {
  if (!import.meta.env.DEV) return all;
  let on = false;
  try {
    const { getRequest } = await import("@tanstack/react-start/server"); const req = getRequest();
    const ref = req.headers.get("referer");
    on = new URL(req.url).searchParams.get("__launches") === "1" || (!!ref && new URL(ref).searchParams.get("__launches") === "1");
  } catch { return all; }
  const base = all.find(s => s.state === "published");
  if (!on || !base) return all;
  const { phDayWindow } = await import("./sources"), w = phDayWindow(Date.now());
  const at = (i: number) => new Date(Date.parse(w.after) + 60_000 * (1 + i)).toISOString();
  const rows = SAMPLE_LAUNCHES.map((l, i) => ({ ...base, id: `launch:sample-${i + 1}`, type: "launch", kicker: "Launch · Product Hunt", headline: `${l.name} — ${l.tagline}`, deck: `${l.votes} upvotes`,
    happened_at: at(i), created_at: at(i), state: "published", status: "published", score: 10, number: 118 + i, domains: [], sector: null, signal_keys: [], source_ids: [], facts: [], basis: null, why_line: null, edits: [], pinnedUntil: null, killReason: null }));
  return [...(rows as unknown as T[]), ...all];
}
