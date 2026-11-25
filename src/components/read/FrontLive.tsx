// The front page's live parts: the date, the ticker (an ink slab), and the live column (a Ledger) that polls /front.json without
// jumping the page; new stories wait behind one Sticker.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useHydrated } from "@tanstack/react-router";
import type { FrontStory, FrontUpdates, TickerItem } from "@/lib/front/front";
import { groupColumn, relTime } from "@/lib/front/front";
import { createPoller, browserPollEnv, type PollResult } from "@/lib/front/poll";
import { announcement, insertPending, newStoriesText, pendingStories, sinceVisit, visitStore } from "@/lib/front/new-stories";
import { UPDATES_PATH } from "@/lib/front/updates";
import { numberLabel } from "@/lib/stories/numbers";
import { NewSticker } from "@/components/a4/Pop";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { TickerTrack } from "@/components/kit/TickerTrack";
import { LedgerItem, StoryNo, ledgerDigits } from "@/components/brand/Ledger";
import { Sticker } from "@/components/brand/Containers";
import { BrandMark } from "./BrandMark";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
/** A clock that keeps itself current: the server's moment first (so hydration matches), then the device clock every 15 s. */
export function useNow(serverNow: string, every = 15_000) {
  const [t, setT] = useState(() => Date.parse(serverNow));
  useEffect(() => { setT(Date.now()); const id = window.setInterval(() => setT(Date.now()), every); return () => window.clearInterval(id); }, [every]);
  return t;
}
/** The front page's date, pinned left (the shell carries the live UTC clock). */
export function FrontDate({ now }: { now: string }) {
  const d = new Date(Date.parse(now));
  return <p className="ed-kicker"><time dateTime={d.toISOString().slice(0, 10)}>{DOW[d.getUTCDay()]} {d.getUTCDate()} {MON[d.getUTCMonth()]} {d.getUTCFullYear()}</time></p>;
}
/** Masthead dateline: the date and time in UTC, the reader's local time beside it once the page is running in their browser. */
export function FrontClock({ now }: { now: string }) {
  const t = useNow(now), d = new Date(t), hydrated = useHydrated();
  const local = hydrated ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
  return <p className="ed-data flex flex-wrap items-center gap-x-2 py-2" aria-label={`${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hhmm(d)} UTC`}>
    <time dateTime={d.toISOString().slice(0, 10)}>{DOW[d.getUTCDay()]} {d.getUTCDate()} {MON[d.getUTCMonth()]} {d.getUTCFullYear()}</time>
    <span><span className="shell-dot tk-tick-dot mr-1" aria-hidden="true" />{hhmm(d)} UTC</span>
    {local && <span className="ed-muted">· {local} your time</span>}
  </p>;
}

const ARROW = { up: "▲", down: "▼", flat: "→" } as const, DIR_WORD = { up: "rising", down: "falling", flat: "flat" } as const;
/** Headline signals with share and direction. The moving track is hidden from screen readers; the same items are one tab stop away as a list. */
export function FrontTicker({ items }: { items: TickerItem[] }) {
  const [paused, setPaused] = useState(false), [list, setList] = useState(false);
  if (!items.length) return null;
  // The ticker is an ink slab: names in paper, shares in yellow, rising arrows in pink.
  const row = items.map(i => <span key={i.key} className="front-ticker-item mr-8 inline-flex gap-2"><span className="ticker-name">{i.name}</span><span className="ticker-share">{pct(i.share, 1)}</span><span className={i.direction === "up" ? "ticker-up" : "ticker-flat"}>{ARROW[i.direction]}</span></span>);
  return <section aria-label="Headline signals" className="front-ticker c-slab no-print" data-container="slab">
    <div className="ed-wrap flex items-center gap-x-3">
      <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true"><TickerTrack paused={paused} duration="60s" className="h-11">{row}</TickerTrack></div>
      <button type="button" className="ed-tap ed-navtext min-h-11 shrink-0 cursor-pointer px-2" aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? "Play" : "Pause"}<span className="sr-only"> the signal ticker</span></button>
      <button type="button" className="ed-tap ed-navtext min-h-11 shrink-0 cursor-pointer px-2" aria-expanded={list} aria-controls="front-ticker-list" onClick={() => setList(l => !l)}>{list ? "Hide list" : "As a list"}</button>
    </div>
    <ul id="front-ticker-list" hidden={!list} className="ed-wrap ed-navtext grid grid-cols-1 gap-x-6 pb-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(i => <li key={i.key}><Link to="/signals/$key" params={{ key: i.key }} className="ed-tap inline-flex min-h-11 items-center gap-2">{i.name} <span className="ticker-share">{pct(i.share, 1)} · {DIR_WORD[i.direction]}</span></Link></li>)}
    </ul>
  </section>;
}

/** One live-column item: a Ledger row with the story's number, its type and sector as tags, one line, the basis mark and a relative time. */
export function LiveItem({ s, now, drop = false, digits = 2 }: { s: FrontStory; now: number; drop?: boolean; digits?: number }) {
  const num = s.number != null ? <StoryNo n={s.number} /> : <StoryNo n="·" blank />;
  return <LedgerItem r={{ key: s.id, id: `fs-${s.id}`, href: s.href, number: num, title: <>{s.domain && <BrandMark icon={s.icon} name={s.domain} size={28} className="mr-2" />}{s.headline}<NewSticker at={s.at} now={now} /></>, line: s.line,
    tags: [s.typeName, ...(s.sectorName ? [s.sectorName] : [])], time: <time dateTime={s.at} title={storyTime(s.at)}>{relTime(s.at, now)}</time>, drop }} digits={digits} story />;
}

/** E3b · the column's own heading: the count sits beside it ("Earlier this week · 6"), and a single group with the same title adds no
 *  second heading. `note` sits under the heading (the quiet line). */
export type ColumnHeading = { id: string; title: string; note?: ReactNode };
type ColumnProps = { initial: FrontStory[]; serverNow: string; sector: string; format: string; quiet: boolean; onUpdates?: (u: FrontUpdates) => void; empty: string; heading?: ColumnHeading };
/** The live column: grouped under time headings, polled about every minute, new stories wait behind one quiet control. */
export function LiveColumn({ initial, serverNow, sector, format, quiet, onUpdates, empty, heading }: ColumnProps) {
  const now = useNow(serverNow, 30_000);
  const [shown, setShown] = useState(initial), [pending, setPending] = useState<FrontStory[]>([]), [said, setSaid] = useState(0), [spoken, setSpoken] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null), [lastVisit, setLastVisit] = useState<string | null>(null);
  const shownRef = useRef(shown); shownRef.current = shown;
  useEffect(() => { setShown(initial); setPending([]); }, [initial]);
  // Since your last visit: read this device's last visit, and record this one when the reader leaves or hides the tab.
  useEffect(() => {
    const store = visitStore(); setLastVisit(store.read());
    const save = () => store.write(new Date().toISOString());
    const vis = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save); document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", vis); };
  }, []);
  useEffect(() => {
    const q = new URLSearchParams({ ...(sector !== "all" ? { sector } : {}), ...(format !== "all" ? { format } : {}) }).toString();
    const poller = createPoller<FrontUpdates>(async etag => {
      const r = await fetch(`${UPDATES_PATH}${q ? `?${q}` : ""}`, { headers: { Accept: "application/json", ...(etag ? { "If-None-Match": etag } : {}) }, credentials: "same-origin" });
      if (r.status === 304) return { status: 304 } as PollResult<FrontUpdates>;
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) throw new Error("poll_failed");
      return { status: 200, etag: r.headers.get("etag"), data: (await r.json()) as FrontUpdates };
    }, u => { setPending(pendingStories(shownRef.current, u.items)); onUpdates?.(u); }, browserPollEnv());
    poller.start();
    return () => poller.stop();
  }, [sector, format, onUpdates]);
  useEffect(() => { const text = announcement(said, pending.length); if (text) { setSpoken(text); setSaid(pending.length); } }, [pending.length, said]);
  useEffect(() => { if (!focusId) return; (document.querySelector(`#fs-${CSS.escape(focusId)} a`) as HTMLElement | null)?.focus(); setFocusId(null); }, [focusId]);
  const groups = useMemo(() => groupColumn(shown, now, { sector, quiet }), [shown, now, sector, quiet]);
  const flat = groups.flatMap(g => g.items), since = sinceVisit(flat, lastVisit);
  const [dropId, setDropId] = useState<string | null>(null);
  // Only the newest inserted story drops in (one thing moves at a time); the rest are simply there.
  const insert = () => { const r = insertPending(shown, pending); setShown(r.items); setPending([]); setSaid(0); setFocusId(r.focusId); setDropId(r.focusId); };
  const marker = since && <li className="front-marker ed-data px-3 py-2" key="since" data-since="">Since your last visit, {relTime(lastVisit!, now)}: {since.count} {since.count === 1 ? "story" : "stories"}</li>;
  // One group under a heading of the same name: the heading carries the count and the group adds no heading of its own.
  const single = !!heading && groups.length === 1 && groups[0]!.title === heading.title;
  return <div>
    {heading && <h2 id={heading.id} className="ed-h2">{heading.title}{flat.length > 0 && <span className="ed-muted"> · {flat.length}</span>}</h2>}
    {heading?.note}
    <p className="sr-only" aria-live="polite">{spoken}</p>
    {pending.length > 0 && <div className="mt-4"><Sticker onClick={insert} data-pop="">{newStoriesText(pending.length)} · show {pending.length === 1 ? "it" : "them"}</Sticker></div>}
    {groups.length ? groups.map(g => <section key={g.id} aria-labelledby={single ? heading!.id : `fg-${g.id}`} className="mt-[var(--sys-gap-heading)]">
      {!single && <h3 id={`fg-${g.id}`} className="ed-kicker">{g.title} <span className="ed-muted">· {g.items.length}</span></h3>}
      <ul className="ledger mt-[var(--sys-gap-heading)]" data-ledger="">{g.items.map(s => [since?.beforeId === s.id ? marker : null, <LiveItem key={s.id} s={s} now={now} drop={s.id === dropId} digits={ledgerDigits(g.items.map(x => x.number))} />])}</ul>
    </section>) : <p className="ed-small mt-4">{empty}</p>}
    {since && since.beforeId === null && flat.length > 0 && <ul className="mt-2">{marker}</ul>}
  </div>;
}
