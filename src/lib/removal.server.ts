// W3d-c Part 4 · what a removal on request does to the pages, without any read on a reader's request and without a migration. On the
// server that took the removal (icon_remove, art_remove): it forgets every copy it holds in memory (page copies, stored-copy memos,
// study models and their input, the museum works), then rewrites the stored page copies that can show the app or the work, from rows
// read after the removal. A study copy that cannot be rewritten in time is replaced by a placeholder older than any build, so readers
// get "being prepared" at once and the sweep rebuilds it first on its next pass. Other servers catch up as their memory copies expire
// (REMOVAL_CATCH_UP in the report). Jobs that write study copies also check, before building, that their cached input is not older than
// the newest removal (`freshAfterRemovals`), so a sweep on another server cannot write the removed app or work back.
import { ICONS_SLUG, MUSEUM_SLUGS } from "./data-stories/registry";
import { pageKey } from "./records/records";
import { memo } from "./memo";

export type RemovalKind = "icon" | "art";
/** The stored copies that can show a removed app or work: the studies that draw them (names, links, thumbnails), then the Studies
 *  home (its headline, deck and key figure come from the same counts). Brand pages read the museum line beside their card, never from it. */
export const copiesFor = (kind: RemovalKind): string[] => [...(kind === "icon" ? [ICONS_SLUG] : MUSEUM_SLUGS).map(s => pageKey("data-story", s)), pageKey("data-index")];
/** Time the removal gives the rewrites before it answers. */
export const REMOVAL_REWRITE_MS = 20_000;
export type RemovalDeps = {
  /** Forget this server's in-memory copies (pages, stored copies, study models, study input, museum works). */
  forget: () => void;
  /** The page body as the sweep builds it. */
  compute: (key: string) => Promise<unknown>;
  write: (rows: { key: string; body: unknown; source: string }[]) => Promise<string[]>;
  now?: () => number;
};
export type RemovalCopies = { rewritten: string[]; held: string[]; failed: string[] };
const STUDY = /^data-story:/;

export async function afterRemoval(kind: RemovalKind, deps?: RemovalDeps, deadline = Date.now() + REMOVAL_REWRITE_MS): Promise<RemovalCopies> {
  const d = deps ?? await realDeps(), now = d.now ?? Date.now, out: RemovalCopies = { rewritten: [], held: [], failed: [] };
  d.forget();
  for (const key of copiesFor(kind)) {
    const left = deadline - now();
    const body = left > 0 ? await within(left, d.compute(key)).catch(() => undefined) : undefined;
    if (body !== undefined) {
      try { out.rewritten.push(...await d.write([{ key, body, source: `removal:${kind}` }])); continue; } catch { /* placeholder below */ }
    }
    // A study copy that could not be rebuilt in time is hidden instead (a "no such study" from no build: readers see "being prepared"
    // and the sweep rebuilds it first). The Studies home names no app or work; it waits for the sweep.
    if (STUDY.test(key)) { try { await d.write([{ key, body: { kind: "missing" }, source: `removal:${kind}` }]); out.held.push(key); continue; } catch { /* failed */ } }
    out.failed.push(key);
  }
  d.forget();
  return out;
}
function within<T>(ms: number, p: Promise<T>): Promise<T | undefined> {
  let t: ReturnType<typeof setTimeout> | undefined;
  p.catch(() => undefined);
  return Promise.race([p, new Promise<undefined>(r => { t = setTimeout(() => r(undefined), Math.max(0, ms)); })]).finally(() => clearTimeout(t));
}

async function realDeps(): Promise<RemovalDeps> {
  const [{ SERVER_PAGES }, store, { forgetStudies }, { forgetDataInput }, { storedArt }, { pageBody }] = await Promise.all([
    import("./page-cache"), import("./records/store.server"), import("./data-stories/page.server"), import("./data-stories/data.server"), import("./art/read.server"), import("./records/refresh.server")]);
  const forget = () => { SERVER_PAGES.clear(); store.forgetReaderCopies(); forgetStudies(); forgetDataInput(); storedArt.clear(); };
  return { forget, compute: pageBody, write: store.writeRecords };
}

/** The newest removal of an app or a work (service role; both tables are small). Jobs only. */
const newestRemoval = memo(30_000, async (): Promise<number> => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [a, b] = await Promise.all([
    db.from("app_icons").select("removed_at").not("removed_at", "is", null).order("removed_at", { ascending: false }).limit(1),
    db.from("art_works").select("removed_at").not("removed_at", "is", null).order("removed_at", { ascending: false }).limit(1),
  ]);
  if (a.error || b.error) throw new Error("removal read failed");
  return Math.max(0, ...[a.data?.[0]?.removed_at, b.data?.[0]?.removed_at].map(x => (x ? Date.parse(x) : 0)));
});
/** Pure: whether a cached input loaded at `loadedAt` predates the newest removal. */
export const inputPredates = (loadedAt: number | undefined, removedAt: number) => loadedAt !== undefined && removedAt > 0 && loadedAt <= removedAt;
/** Jobs that write study copies call this first: a cached study input older than the newest removal is dropped (with the models and the
 *  museum works built from it), so the copy is built from rows read after the removal. An unreadable removal list changes nothing. */
export async function freshAfterRemovals(): Promise<boolean> {
  const { peekDataInput } = await import("./data-stories/data.server");
  const at = await newestRemoval().catch(() => 0);
  if (!inputPredates(peekDataInput()?.now, at)) return false;
  const [{ forgetStudies }, { forgetDataInput }, { storedArt }] = await Promise.all([import("./data-stories/page.server"), import("./data-stories/data.server"), import("./art/read.server")]);
  forgetStudies(); forgetDataInput(); storedArt.clear();
  return true;
}
