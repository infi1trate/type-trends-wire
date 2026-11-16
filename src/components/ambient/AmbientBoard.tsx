import { line } from "@/lib/voice";
// /ambient: the studio-wall board (Loud, dark). Its own chrome only: the mark on its pink slab, the red live dot, the clock (UTC and local),
// the date and state, and the ticker along the bottom. Scenes from the pure playlist (lib/ambient/playlist.ts), one at a time, each changing
// with the Cut (a hard wipe; none under reduced motion). It polls /front.json with its ETag and keeps what it has when the network is late.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ambientQuery } from "@/lib/data";
import { EMPTY_BOARD_LINE, SCENE_NAME, playlist, playlistKey, type AmbientInput, type AmbientOptions, type Scene } from "@/lib/ambient/playlist";
import { POINTER_IDLE_MS, TAP_BAR_MS, asOfText, boardKey, boardPoll, feedStart, idle, isLate, shiftOf, slabCorner, step, wakeLock, type BoardAction, type Feed, type Timers } from "@/lib/ambient/board";
import { createPoller, browserPollEnv } from "@/lib/front/poll";
import { UPDATES_PATH } from "@/lib/front/updates";
import { numberLabel } from "@/lib/stories/numbers";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { sectorName } from "@/lib/labels";
import { Wordmark } from "@/components/brand/Wordmark";
import { Plate, Raised } from "@/components/brand/Containers";
import { Ledger } from "@/components/brand/Ledger";
import { SoftObject, Trail } from "@/components/brand/Illustration";
import { TickerTrack } from "@/components/kit/TickerTrack";
import { Wall } from "@/components/read/Wall";
import { CaptureFrame, FigureView } from "@/components/data/Figures";
import { pairStamps } from "@/lib/data-stories/text";
import type { BeforeAfterFig } from "@/lib/data-stories/types";

const STATE_WORD = { busy: "BUSY", steady: "STEADY", quiet: "QUIET" } as const;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");
const timers: Timers = { set: (fn, ms) => window.setTimeout(fn, ms), clear: t => window.clearTimeout(t as number) };
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** The device clock, client only (null on the server, so hydration matches). */
function useClock(every = 1000) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { setT(Date.now()); const id = window.setInterval(() => setT(Date.now()), every); return () => window.clearInterval(id); }, [every]);
  return t;
}

function Clock({ t, late, asOf, paused }: { t: number | null; late: boolean; asOf: string | null; paused: boolean }) {
  const d = t === null ? null : new Date(t);
  const local = d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return <div className="amb-clock" data-board-clock="">
    <span className={`amb-dot ${late ? "amb-dot-hollow" : "tk-tick-dot"}`} aria-hidden="true" data-late={late ? "" : undefined} />
    <span className="amb-time">{d ? <time dateTime={d.toISOString()}>{p2(d.getUTCHours())}:{p2(d.getUTCMinutes())} UTC</time> : "UTC"}</span>
    {local && <span className="amb-muted">{local} local</span>}
    {late && asOf && <span className="amb-muted" data-as-of="">{asOf}</span>}
    {paused && <span className="amb-muted" data-paused-word="">Paused</span>}
  </div>;
}

function Top({ m, corner, clock }: { m: AmbientInput; corner: "left" | "right"; clock: ReactNode }) {
  const d = new Date(Date.parse(`${m.today}T12:00:00Z`));
  return <header className="amb-top" data-corner={corner}>
    <div className="amb-brand"><span className="amb-mark"><Wordmark height={96} ground="ink" /></span>
      <span className="amb-date"><time dateTime={m.today}>{DOW[d.getUTCDay()]} {d.getUTCDate()} {MON[d.getUTCMonth()]} {d.getUTCFullYear()}</time> · <span data-board-state="">{STATE_WORD[m.state]}</span>{m.sector !== "all" ? ` · ${sectorName(m.sector)}` : ""}</span></div>
    {clock}
  </header>;
}

function Ticker({ m }: { m: AmbientInput }) {
  if (!m.ticker.length) return <div className="amb-ticker c-slab" data-container="slab" />;
  return <div className="amb-ticker c-slab" data-container="slab" aria-hidden="true">
    <TickerTrack duration="90s">{m.ticker.map(i => <span key={i.key} className="amb-tick"><span>{i.name}</span><span className="ticker-share">{pct(i.share, 1)}</span><span className={i.direction === "up" ? "ticker-up" : "ticker-flat"}>{i.direction === "up" ? "▲" : i.direction === "down" ? "▼" : "→"}</span></span>)}</TickerTrack>
  </div>;
}

/** The two captures side by side, captions at board size, each carrying its own stamp (time added when they share a day). */
function PairFrames({ f }: { f: BeforeAfterFig }) {
  const [b, a] = pairStamps(f.before.at, f.after.at);
  return <div className="amb-pair-grid" data-board-pair="">
    <figure><CaptureFrame fr={f.before} label={`${f.name}, ${b}`} /><figcaption className="amb-kicker" data-stamp="before">Before · {b}</figcaption></figure>
    <figure><CaptureFrame fr={f.after} label={`${f.name}, ${a}`} /><figcaption className="amb-kicker" data-stamp="after">After · {a}</figcaption></figure>
  </div>;
}

function SceneView({ s }: { s: Scene }) {
  switch (s.id) {
    case "cover": { const l = s.lead; return <Plate className="amb-cover">
      <p className="amb-kicker">{l.number != null && <span>{numberLabel(l.number)} · </span>}{l.label} · {l.typeName}{l.sectorName ? ` · ${l.sectorName}` : ""}</p>
      <h2 className="amb-h">{l.headline}</h2>
      {l.why && <p className="amb-body amb-why">{l.why}</p>}
      <p className="amb-kicker"><time dateTime={l.at}>{storyTime(l.at)}</time></p>
    </Plate>; }
    case "ledger": return <section className="amb-ledger" aria-labelledby="amb-s"><h2 id="amb-s" className="amb-title">The newest stories</h2>
      <Ledger label="The newest stories" rows={s.stories.map(x => ({ key: x.id, href: `/stories/${encodeURIComponent(x.id)}`, number: x.number != null ? numberLabel(x.number) : "", title: x.headline, tags: [x.typeName], time: <time dateTime={x.at}>{storyTime(x.at)}</time> }))} /></section>;
    case "trail": return <section className="amb-split" aria-labelledby="amb-s"><div className="amb-split-text"><p className="amb-kicker">Chart of the day</p><h2 id="amb-s" className="amb-title">{s.chart.title}</h2><p className="amb-body amb-muted">{s.chart.note}</p></div>
      <div className="amb-split-pic"><Trail points={s.chart.points} label={s.chart.name} format={v => pct(v, 1) ?? ""} seed={s.chart.name} /></div></section>;
    case "pair": return <section className="amb-pair" aria-labelledby="amb-s"><p className="amb-kicker">A recent move · {s.move.name}</p><h2 id="amb-s" className="amb-title">{s.move.text}</h2>
      <PairFrames f={s.move.pair} /></section>;
    case "wall": return <section className="amb-wall" aria-labelledby="amb-s"><p className="amb-kicker">Collection No. {s.collection.number}</p><h2 id="amb-s" className="amb-title">{s.collection.title}</h2>
      <Wall tiles={s.collection.tiles.map(t => ({ ...t, size: "sm" as const }))} label={s.collection.title} eager={12} /></section>;
    case "figure": return <section className="amb-split" aria-labelledby="amb-s"><div className="amb-split-pic"><SoftObject text={s.figure.value} seed={s.figure.key} label={s.figure.caption} /></div>
      <div className="amb-split-text"><p className="amb-kicker">The Morning Line · the day's figure</p><h2 id="amb-s" className="amb-title">{s.figure.name}</h2><p className="amb-body">{s.figure.caption}</p></div></section>;
    case "data": return <section className="amb-data" aria-labelledby="amb-s"><p className="amb-kicker">Data story {s.data.number}</p><h2 id="amb-s" className="amb-title">{s.data.question}</h2>
      <p className="amb-body">{s.data.step.caption.map((c, k) => <span key={k}>{typeof c === "string" ? c : "n" in c ? <strong>{c.n}</strong> : c.r}</span>)}</p>
      <div className="amb-data-fig"><FigureView fig={s.data.figure} view={s.data.step.view} /></div></section>;
  }
}

export function AmbientBoard({ opts }: { opts: AmbientOptions }) {
  const qc = useQueryClient(), navigate = useNavigate();
  const { data } = useSuspenseQuery(ambientQuery(opts.sector));
  const [feed, setFeed] = useState<Feed<AmbientInput>>(() => feedStart(data, Date.parse(data.now)));
  const [list, setList] = useState<Scene[]>(() => playlist(data, opts));
  const [at, setAt] = useState(0), [turns, setTurns] = useState(0), [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState(true), [bar, setBar] = useState(false), [cut, setCut] = useState(false);
  const pending = useRef<Scene[] | null>(null), listRef = useRef(list);
  listRef.current = list;
  const now = useClock();
  const late = now !== null && isLate(feed, now, feed.data.freshness?.late ?? false);

  // Advance: finish the current scene, then pick up a rebuilt playlist if the data changed.
  const go = useCallback((dir: 1 | -1) => {
    let cur = listRef.current;
    if (pending.current) { cur = pending.current; pending.current = null; setList(cur); }
    setAt(i => step(Math.min(i, Math.max(0, cur.length - 1)), cur.length, dir));
    setTurns(t => t + 1);
    setCut(!reducedMotion());
  }, []);
  useEffect(() => { if (paused || list.length < 2) return; const id = window.setTimeout(() => go(1), opts.dwell * 1000); return () => window.clearTimeout(id); }, [paused, list.length, at, turns, opts.dwell, go]);

  // Polling /front.json (ETag; 304 costs nothing). A change refetches the board's input; a failure keeps the last good data and marks it late.
  useEffect(() => {
    const q = opts.sector !== "all" ? `?sector=${encodeURIComponent(opts.sector)}` : "";
    const fetchOnce = boardPoll<AmbientInput>({
      head: async etag => { const r = await fetch(`${UPDATES_PATH}${q}`, { headers: etag ? { "If-None-Match": etag } : {}, credentials: "same-origin" }); return { status: r.status, etag: r.headers.get("etag") }; },
      load: () => qc.fetchQuery({ ...ambientQuery(opts.sector), staleTime: 0 }),
      now: () => Date.now(), feed: setFeed,
      fresh: next => { const rebuilt = playlist(next, opts); if (playlistKey(rebuilt) !== playlistKey(listRef.current)) pending.current = rebuilt; },
    });
    const p = createPoller(fetchOnce, () => undefined, browserPollEnv());
    p.start();
    return () => p.stop();
  }, [qc, opts]);

  // The screen stays awake where the browser allows it.
  useEffect(() => {
    const wl = wakeLock(navigator as never);
    void wl.request();
    const vis = () => { if (document.visibilityState === "visible") void wl.visible(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void wl.release(); };
  }, []);

  // The pointer hides after three seconds of stillness; a tap shows the control bar for five.
  const pointer = useMemo(() => (typeof window === "undefined" ? null : idle(timers, POINTER_IDLE_MS, setCursor)), []);
  const tapBar = useMemo(() => (typeof window === "undefined" ? null : idle(timers, TAP_BAR_MS, setBar)), []);
  useEffect(() => { pointer?.poke(); return () => { pointer?.stop(); tapBar?.stop(); }; }, [pointer, tapBar]);

  const act = useCallback((a: BoardAction) => {
    if (a === "pause") setPaused(p => !p);
    else if (a === "prev") go(-1);
    else if (a === "next") go(1);
    else if (a === "fullscreen") { if (document.fullscreenElement) void document.exitFullscreen?.(); else void document.documentElement.requestFullscreen?.().catch(() => undefined); }
    else if (a === "leave") { if (!document.fullscreenElement) void navigate({ to: "/" }); }
  }, [go, navigate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "BUTTON" || t.tagName === "A") && e.key !== "Escape" && e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = boardKey(e.key); if (!a) return;
      e.preventDefault(); act(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  const m = feed.data, s = list[Math.min(at, list.length - 1)] ?? null, [dx, dy] = shiftOf(turns);
  const clock = <Clock t={now} late={late} asOf={asOfText(feed.goodAt)} paused={paused} />;
  return <div className="amb digest" data-board="" data-cursor={cursor ? undefined : "hidden"} style={{ transform: `translate(${dx}px, ${dy}px)` }}
    onPointerMove={e => { if (e.pointerType === "mouse") pointer?.poke(); }}
    onPointerDown={e => { if (e.pointerType !== "mouse") tapBar?.poke(); else pointer?.poke(); }}>
    <Top m={m} corner={slabCorner(turns)} clock={clock} />
    <main className="amb-stage" aria-roledescription="board">
      <h1 className="sr-only">Studio board{s ? `: ${SCENE_NAME[s.id]}` : ""}</h1>
      {s ? <div key={`${s.id}-${turns}`} className={`amb-scene ${cut ? "amb-cut" : ""}`} data-scene={s.id} onAnimationEnd={() => setCut(false)}><SceneView s={s} /></div>
        : <div className="amb-empty" data-board-empty=""><span className="amb-mark-big"><Wordmark height={192} ground="ink" decorative /></span><p className="amb-body">{EMPTY_BOARD_LINE}</p></div>}
    </main>
    <Ticker m={m} />
    {bar && <div className="amb-bar" role="toolbar" aria-label="Board controls" data-tap-bar="">
      <Raised type="button" onClick={() => { act("pause"); tapBar?.poke(); }} aria-pressed={paused}>{paused ? "Play" : "Pause"}</Raised>
      <Raised type="button" onClick={() => { act("prev"); tapBar?.poke(); }}>Previous</Raised>
      <Raised type="button" onClick={() => { act("next"); tapBar?.poke(); }}>Next</Raised>
      <Raised type="button" onClick={() => { act("fullscreen"); tapBar?.poke(); }}>Full screen</Raised>
    </div>}
  </div>;
}

/** When even the first read fails: the mark, the clock and one line, and another try in a minute (never an error page). */
export function AmbientWaiting({ retry }: { retry: () => void }) {
  const t = useClock();
  useEffect(() => { const id = window.setTimeout(retry, 60_000); return () => window.clearTimeout(id); }, [retry]);
  const d = t === null ? null : new Date(t);
  return <div className="amb digest" data-board="">
    <main className="amb-stage"><h1 className="sr-only">Studio board</h1>
      <div className="amb-empty" data-board-empty=""><span className="amb-mark-big"><Wordmark height={192} ground="ink" decorative /></span>
        <p className="amb-h">{d ? `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC` : "UTC"}</p>
        <p className="amb-body">{line("ambient.failed")}</p></div>
    </main>
  </div>;
}
