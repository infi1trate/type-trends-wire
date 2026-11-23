// C1b Part 1 · where each page's announced picture comes from, read once per instance and object for a minute (first-paint.ts has
// the rule). Today: the stored `front-first` record (the lead's picture, written with the front's other records). A brand: its
// cover (the same `picsFor` read the card itself makes, shared in flight). A story: its lead plan in the stored `front-leads` record
// (the rule picks a picture before it ever falls back to a chart, so the front's plan is the story page's plan when it draws one). The
// two records are read with a plain request and this module's imports are all small and static (src/server.ts loads it with the
// entry), so the read leaves before the page code is even evaluated.
// `startFirstPaint` begins the read the moment a page request arrives, before the page code has loaded; the page's loader then waits
// until FIRST_PAINT_DEADLINE_MS after the request arrived (firstWaitMs). Never throws: an unknown answer announces nothing.
import { memoBy } from "./memo";
import { restRows } from "./plain-rest.server";
import { usable } from "./records/records";
import { NO_FIRST, firstOf, firstWaitMs, patternPicture, planPicture, thumbPicture, type FirstKind, type FirstPaint } from "./first-paint";

/** One stored record by key through a plain read (no database library loads before the page's first flush), when still usable. */
const record = memoBy(60_000, async (key: string): Promise<unknown> => {
  const row = (await restRows("public", "read_records", `select=key,body,computed_at&key=eq.${encodeURIComponent(key)}&limit=1`))[0] as { key: string; body: unknown; computed_at: string } | undefined;
  return row && usable(row, Date.now()) ? row.body : null;
}, { key: k => k, max: 4, retries: 0 });

// A failed read throws here, so it is not kept: the next request reads again (firstPaintFor answers none meanwhile).
const load = async ({ kind, id }: { kind: FirstKind; id: string }): Promise<FirstPaint> => {
  if (kind === "front") {
    const body = (await record("front-first")) as FirstPaint | null;
    return body && typeof body === "object" ? { picture: body.picture ?? null } : NO_FIRST;
  }
  if (kind === "brand") {
    const [{ picsFor }, { coverOf }] = await Promise.all([import("./pictures.server"), import("./pictures")]);
    const cover = coverOf(id, await picsFor(id));
    return { picture: cover ? { href: cover.src, srcSet: null, sizes: null, media: null } : null };
  }
  // W3d Part 5 · a brand's Data view: its newest homepage thumbnail (the rows SiteThumb reads, anonymous, plain request).
  if (kind === "brand-data") {
    const [rows, { pickThumb }] = await Promise.all([restRows("public", "site_thumbs", `select=domain,captured_at,viewport,path,width,height,bytes,variants&domain=eq.${encodeURIComponent(id)}&order=captured_at.desc&limit=4`), import("./thumbs")]);
    return { picture: thumbPicture(pickThumb(rows as never, id)) };
  }
  // A pattern without a lens: the first example with a crop, from the same model the page streams (its reads are shared in flight).
  if (kind === "pattern") return { picture: patternPicture(await (await import("./read.server")).loadPattern(id, "all")) };
  const leads = (await record("front-leads")) as Record<string, { plan?: import("./lead-picture").LeadPlan | null } | null> | null;
  return { picture: planPicture(leads?.[id]?.plan ?? null, "story") };
};
const firsts = memoBy(60_000, load, { key: k => `${k.kind}|${k.id}`, max: 200, retries: 0 });

/** Begin the read for a page request (a GET of Today, a brand or a story); anything else starts nothing. */
export function startFirstPaint(url: URL): void {
  const k = firstOf(url.pathname, url.searchParams);
  if (!k) return;
  started.set(`${k.kind}|${k.id}`, Date.now());
  if (started.size > 200) started.delete(started.keys().next().value as string);
  void firsts(k).catch(() => undefined);
}
/** When each object's read last began (its request's arrival), so the loader waits until the deadline counted from then. */
const started = new Map<string, number>();
/** The page's announced picture, or none when its read has not answered by FIRST_PAINT_DEADLINE_MS after the request arrived. */
export function firstPaintFor(kind: FirstKind, id: string, waitMs?: number): Promise<FirstPaint> {
  if (waitMs === undefined) { const at = started.get(`${kind}|${id}`); waitMs = firstWaitMs(at === undefined ? null : Date.now() - at); }
  let t: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<FirstPaint>(resolve => { t = setTimeout(() => resolve(NO_FIRST), waitMs); });
  return Promise.race([firsts({ kind, id }).catch(() => NO_FIRST), late]).finally(() => clearTimeout(t));
}
