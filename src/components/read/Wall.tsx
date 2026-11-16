// THE WALL: tiles on the 8 px grid in two sizes, one list for assistive technology with a name per tile, arrow keys between tiles.
// Each tile is one stored capture: its section crop in one ink when one exists, otherwise the capture redrawn from its stored
// skeleton. No filtered illustration ever sits in a wall. "More" appends the next page and keeps focus; without JavaScript it is a link.
import { useRef, useState, type KeyboardEvent } from "react";
import type { GalleryTile } from "@/lib/gallery";
import { CaptureFrame } from "@/components/data/Figures";
import { FRAME_LABEL } from "@/lib/stories/frames";
import { countLine, GALLERY_PAGE } from "@/lib/gallery";

function Tile({ t }: { t: GalleryTile }) {
  return <a href={t.href} className="wall-tile" aria-label={t.label} data-tile={t.id}>
    <span aria-hidden="true" className="block">
      {t.crop ? <img src={t.crop.src} width={t.crop.width} height={t.crop.height} alt="" loading="lazy" className="wall-ink border" style={{ borderColor: "var(--tk-rule-hairline)" }} data-frame="crop" />
        : t.frame ? <CaptureFrame fr={t.frame} label={t.label} />
        : <span className="ed-caption block border p-3" style={{ borderColor: "var(--tk-rule-hairline)" }}>No stored layout to redraw</span>}
    </span>
    <span className="wall-cap" aria-hidden="true"><span>{t.domain}</span><span>{t.day}</span>{t.note && <span>{t.note}</span>}</span>
  </a>;
}
/** Arrow keys move between tiles: left/right in reading order, up/down to the nearest tile in the row above or below. */
function move(e: KeyboardEvent<HTMLUListElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const tiles = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>("a.wall-tile")], i = tiles.indexOf(document.activeElement as HTMLAnchorElement);
  if (i < 0) return;
  let next = i;
  if (e.key === "ArrowRight") next = Math.min(tiles.length - 1, i + 1);
  else if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = tiles.length - 1;
  else {
    const r = tiles[i]!.getBoundingClientRect(), cx = r.left + r.width / 2, down = e.key === "ArrowDown";
    let best = -1, bestD = Infinity;
    tiles.forEach((t, k) => { const q = t.getBoundingClientRect(); if (down ? q.top < r.bottom - 1 : q.bottom > r.top + 1) return; const d = Math.abs(q.top - r.top) * 4 + Math.abs(q.left + q.width / 2 - cx); if (d < bestD) { bestD = d; best = k; } });
    if (best >= 0) next = best;
  }
  if (next !== i) { e.preventDefault(); tiles[next]!.focus(); }
}
export function Wall({ tiles, label }: { tiles: GalleryTile[]; label: string }) {
  return <ul className="wall" aria-label={label} onKeyDown={move} data-wall="">{tiles.map(t => <li key={t.id} className={t.size === "lg" ? "tile-lg" : "tile-sm"}><Tile t={t} /></li>)}</ul>;
}

/** A wall with its count line, "More" (appends, keeps focus) and the no-JavaScript paged links. */
export function PagedWall({ tiles, total, page, pages, label, hrefFor, fetchPage }: {
  tiles: GalleryTile[]; total: number; page: number; pages: number; label: string; hrefFor: (page: number) => string;
  fetchPage: (page: number) => Promise<GalleryTile[]>;
}) {
  const [extra, setExtra] = useState<GalleryTile[]>([]), [loaded, setLoaded] = useState(page), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const shown = [...tiles, ...extra], from = (page - 1) * GALLERY_PAGE + 1, to = from + shown.length - 1;
  const more = async () => {
    setBusy(true); setErr(null);
    try {
      const add = await fetchPage(loaded + 1), first = add[0]?.id;
      setExtra(x => [...x, ...add]); setLoaded(p => p + 1);
      requestAnimationFrame(() => { if (first) root.current?.querySelector<HTMLElement>(`[data-tile="${first}"]`)?.focus(); });
    } catch { setErr("The next tiles didn't load. Try More again in a moment."); }
    finally { setBusy(false); }
  };
  const nextHref = loaded < pages ? hrefFor(loaded + 1) : null;
  return <div ref={root}>
    <p className="ed-data mt-2" aria-live="polite" data-count-line="">{countLine(total ? from : 0, total ? to : 0, total)}</p>
    {shown.length > 0 && <div className="mt-4"><Wall tiles={shown} label={label} /></div>}
    <p className="ed-caption mt-3">Tiles without a section crop are {FRAME_LABEL.toLowerCase()}: boxes from the stored capture in its own colours, the first screen only. No screenshot is stored.</p>
    <nav aria-label="More captures" className="no-print mt-6 flex flex-wrap items-center gap-4">
      {page > 1 && <a href={hrefFor(page - 1)} className="ed-tap ed-data">← Previous {GALLERY_PAGE}</a>}
      {nextHref && <a href={nextHref} data-container="raised" className="c-raised ed-kicker no-underline" aria-disabled={busy || undefined} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); if (!busy) void more(); }}>{busy ? "Loading…" : `More · next ${Math.min(GALLERY_PAGE, total - to)}`}</a>}
      {err && <span role="alert" className="ed-small form-error">{err}</span>}
    </nav>
  </div>;
}
