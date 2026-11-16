// The front page's live parts: the clock, the ticker, and the live column that polls /front.json without jumping the page.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useHydrated } from "@tanstack/react-router";
import type { FrontStory, FrontUpdates, TickerItem } from "@/lib/front/front";
import { groupColumn, relTime } from "@/lib/front/front";
import { createPoller, browserPollEnv, type PollResult } from "@/lib/front/poll";
import { announcement, insertPending, newStoriesText, pendingStories, sinceVisit, visitStore } from "@/lib/front/new-stories";
import { UPDATES_PATH } from "@/lib/front/updates";
import { numberLabel } from "@/lib/stories/numbers";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { TickerTrack } from "@/components/kit/TickerTrack";
import { StoryRow } from "./StoryCard";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
/** A clock that keeps itself current: the server's moment first (so hydration matches), then the device clock every 15 s. */
export function useNow(serverNow: string, every = 15_000) {
  const [t, setT] = useState(() => Date.parse(serverNow));
  useEffect(() => { setT(Date.now()); const id = window.setInterval(() => setT(Date.now()), every); return () => window.clearInterval(id); }, [every]);
  return t;
}
/** Masthead dateline: the date and time in UTC, the reader's local time beside it once the page is running in their browser. */
export function FrontClock({ now }: { now: string }) {
  const t = useNow(now), d = new Date(t), hydrated = useHydrated();
  const local = hydrated ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
  return <p className="ed-data flex flex-wrap items-center gap-x-2 py-2" aria-label={`${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hhmm(d)} UTC`}>
    <time dateTime={d.toISOString().slice(0, 10)}>{DOW[d.getUTCDay()]} {d.getUTCDate()} {MON[d.getUTCMonth()]} {d.getUTCFullYear()}</time>
    <span className="tk-t-data"><span className="tk-tick-dot mr-1 inline-block h-2 w-2" aria-hidden="true" />{hhmm(d)} UTC</span>
    {local && <span className="ed-muted">· {local} your time</span>}
  </p>;
}

const ARROW = { up: "▲", down: "▼", flat: "→" } as const, DIR_WORD = { up: "rising", down: "falling", flat: "flat" } as const;
/** Headline signals with share and direction. The moving track is hidden from screen readers; the same items are one tab stop away as a list. */
export function FrontTicker({ items }: { items: TickerItem[] }) {
  const [paused, setPaused] = useState(false), [list, setList] = useState(false);
  if (!items.length) return null;
  const row = items.map(i => <span key={i.key} className="front-ticker-item mr-8 inline-flex gap-2"><span className="font-semibold">{i.name}</span><span className="ed-muted">{pct(i.share, 1)}</span><span className={i.direction === "up" ? "front-up" : "ed-muted"}>{ARROW[i.direction]}</span></span>);
  return <section aria-label="Headline signals" className="front-ticker no-print">
    <div className="ed-wrap flex items-center gap-x-3">
      <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true"><TickerTrack paused={paused} duration="60s" className="h-11">{row}</TickerTrack></div>
      <button type="button" className="ed-tap ed-data min-h-11 shrink-0 cursor-pointer px-2" aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? "Play" : "Pause"}<span className="sr-only"> the signal ticker</span></button>
      <button type="button" className="ed-tap ed-data min-h-11 shrink-0 cursor-pointer px-2" aria-expanded={list} aria-controls="front-ticker-list" onClick={() => setList(l => !l)}>{list ? "Hide list" : "As a list"}</button>
    </div>
    <ul id="front-ticker-list" hidden={!list} className="ed-wrap ed-data grid grid-cols-1 gap-x-6 pb-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(i => <li key={i.key}><Link to="/signals/$key" params={{ key: i.key }} className="ed-tap inline-flex min-h-11 items-center gap-2">{i.name} <span className="ed-muted">{pct(i.share, 1)} · {DIR_WORD[i.direction]}</span></Link></li>)}
    </ul>
  </section>;
}

/** One live-column item: the compact story card with its type chip, one line, basis mark, number and a relative time. */
export function LiveItem({ s, now }: { s: FrontStory; now: number }) {
  return <StoryRow id={`fs-${s.id}`} s={{ id: s.id, type: s.type as never, kicker: s.kicker, headline: s.headline, at: s.at, signalKeys: [], domains: [], evidence: s.href, basis: s.basis, number: s.number }}
    kicker={<span className="label tk-row-muted"><span className="tk-chip mr-1 inline-block border px-1">{s.typeName}</span>{s.sectorName ? `${s.sectorName.toUpperCase()} · ` : ""}</span>}
    line={s.line} wide n={s.number != null ? numberLabel(s.number).toUpperCase() : "·"}
    time={<time dateTime={s.at} title={storyTime(s.at)}>{relTime(s.at, now).toUpperCase()}</time>} />;
}

type ColumnProps = { initial: FrontStory[]; serverNow: string; sector: string; format: string; quiet: boolean; onUpdates?: (u: FrontUpdates) => void; empty: string };
/** The live column: grouped under time headings, polled about every minute, new stories wait behind one quiet control. */
export function LiveColumn({ initial, serverNow, sector, format, quiet, onUpdates, empty }: ColumnProps) {
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
  const insert = () => { const r = insertPending(shown, pending); setShown(r.items); setPending([]); setSaid(0); setFocusId(r.focusId); };
  const marker = since && <li className="front-marker ed-data px-3 py-2" key="since">Since your last visit, {relTime(lastVisit!, now)}: {since.count} {since.count === 1 ? "story" : "stories"}</li>;
  return <div>
    <p className="sr-only" aria-live="polite">{spoken}</p>
    {pending.length > 0 && <button type="button" onClick={insert} className="front-new ed-data mt-3 min-h-11 w-full cursor-pointer px-3 text-left">{newStoriesText(pending.length)} · show {pending.length === 1 ? "it" : "them"}</button>}
    {groups.length ? groups.map(g => <section key={g.id} aria-labelledby={`fg-${g.id}`} className="mt-6">
      <h3 id={`fg-${g.id}`} className="ed-kicker">{g.title} <span className="ed-muted">· {g.items.length}</span></h3>
      <ul className="mt-2 border-t border-ed-rule">{g.items.map(s => [since?.beforeId === s.id ? marker : null, <LiveItem key={s.id} s={s} now={now} />])}</ul>
    </section>) : <p className="ed-small mt-4">{empty}</p>}
    {since && since.beforeId === null && flat.length > 0 && <ul className="mt-2">{marker}</ul>}
  </div>;
}
