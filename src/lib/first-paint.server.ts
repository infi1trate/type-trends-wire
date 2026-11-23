// C1b Part 1 · where each page's announced picture comes from, read once per instance and object for a minute (first-paint.ts has
// the rule). Today: the stored `front-first` record (the lead's picture, written with the front's other records). A brand: its
// cover (the same `picsFor` read the card itself makes, shared in flight). A story: its lead plan in the stored `front-leads` record
// (the rule picks a picture before it ever falls back to a chart, so the front's plan is the story page's plan when it draws one).
// `startFirstPaint` begins the read the moment a page request arrives, before the page code has loaded; the page's loader then waits
// at most FIRST_PAINT_WAIT_MS for it. Never throws: an unknown answer announces nothing.
import { memoBy } from "./memo";
import { FIRST_PAINT_WAIT_MS, NO_FIRST, firstOf, planPicture, type FirstKind, type FirstPaint } from "./first-paint";

const load = async ({ kind, id }: { kind: FirstKind; id: string }): Promise<FirstPaint> => {
  if (kind === "front") {
    const [{ readRecord }, { usable }] = await Promise.all([import("./records/store.server"), import("./records/records")]);
    const row = await readRecord<FirstPaint>("front-first");
    return row && usable(row, Date.now()) && row.body && typeof row.body === "object" ? { picture: row.body.picture ?? null } : NO_FIRST;
  }
  if (kind === "brand") {
    const [{ picsFor }, { coverOf }] = await Promise.all([import("./pictures.server"), import("./pictures")]);
    const cover = coverOf(id, await picsFor(id));
    return { picture: cover ? { href: cover.src, srcSet: null, sizes: null, media: null } : null };
  }
  const { storedFrontLeads } = await import("./front/front.server");
  const rec = await storedFrontLeads();
  return { picture: planPicture(rec?.[id]?.plan ?? null, "story") };
};
const firsts = memoBy(60_000, (k: { kind: FirstKind; id: string }) => load(k).catch(() => NO_FIRST), { key: k => `${k.kind}|${k.id}`, max: 200, retries: 0 });

/** Begin the read for a page request (a GET of Today, a brand or a story); anything else starts nothing. */
export function startFirstPaint(url: URL): void {
  const k = firstOf(url.pathname, url.searchParams);
  if (k) void firsts(k);
}
/** The page's announced picture, or none when its read has not answered within FIRST_PAINT_WAIT_MS. */
export function firstPaintFor(kind: FirstKind, id: string, waitMs = FIRST_PAINT_WAIT_MS): Promise<FirstPaint> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<FirstPaint>(resolve => { t = setTimeout(() => resolve(NO_FIRST), waitMs); });
  return Promise.race([firsts({ kind, id }), late]).finally(() => clearTimeout(t));
}
