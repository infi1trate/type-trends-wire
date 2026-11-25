// U1 · the Data view of each object type (`?view=data` on its one address), inside DataShell. Dark and dense, built from the terminal's
// own parts; tables load after the frame (Later skeletons). Every table, score and field the terminal showed for the object is here.
import { WhyNow } from "@/components/read/WhyNow";
import { MUSEUM_SHOWN } from "@/lib/site";
import { changeDates } from "@/lib/views/receipts";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { brandCardQuery, brandSurfacesQuery, forecastDetailQuery, librarySiteQuery, patternsQuery, storyDataQuery, studyDataQuery, weekDataQuery, dataStoryQuery, signalsQuery, brandStructureQuery } from "@/lib/data";
import { NOT_READ } from "@/lib/structure";
import { LibraryBand, ChangeValues } from "@/components/terminal/LibraryShared";
import { LibrarySite } from "@/components/terminal/LibrarySite";
import { TraitDetail, BriefView } from "@/components/terminal/Forecast";
import { BriefWithdrawn } from "@/components/terminal/BriefWithdrawn";
import { StageBadge } from "@/components/terminal/Info";
import { BasisChip } from "@/components/terminal/SignalBits";
import { AppLink } from "@/components/terminal/AppLink";
import { Later, ROW } from "@/components/read/Later";
import { DataTable } from "./DataTable";
import { DataNote } from "./DataShell";
import { StoryLink } from "./StoryLink";
import { factsSheet } from "@/lib/data-stories/writer";
import { consoleHref, lensedFigureTables, studyCommand } from "@/lib/views/study-commands";
import { resolveSector } from "@/lib/sector-lens";
import { briefMovers } from "@/lib/views/week";
import { brandDataPath, dataHref } from "@/lib/ia";
import { label } from "@/lib/labels";
import { show } from "@/lib/library";
import { assetVerdictText } from "@/lib/surfaces";
import type { Edition } from "@/lib/digest/edition";
import type { ArtNear } from "@/lib/art/read.server";
import type { AccentNear } from "@/lib/art/accent";

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "–");
const rowsShape = (n = 6) => [{ kind: "rows" as const, n, height: ROW.compact }];
const Band = ({ title, children }: { title: string; children: ReactNode }) => <LibraryBand title={title}>{children}</LibraryBand>;
const P = ({ children }: { children: ReactNode }) => <p className="p-3 text-compare-muted">{children}</p>;
const Lnk = ({ href, children }: { href: string; children: ReactNode }) => <AppLink href={href} className="text-ink underline underline-offset-2">{children}</AppLink>;
const split = (k: string) => { const i = k.indexOf(":"); return { dimension: k.slice(0, i), value: k.slice(i + 1) }; };

// STORY --------------------------------------------------------------------------------------------------------------------------
export function StoryData({ id }: { id: string }) {
  return <Later id="story-data-later" shapes={rowsShape(8)}><StoryDataBody id={id} /></Later>;
}
function StoryDataBody({ id }: { id: string }) {
  const { data: s } = useSuspenseQuery(storyDataQuery(id));
  if (!s) return <DataNote>No stored record for this story.</DataNote>;
  return <>
    <Band title="SCORE AND RANK">
      <dl className="grid grid-cols-2 sm:grid-cols-4">{([["STATE", s.state.toUpperCase()], ["SCORE", String(s.score)], ["RANK SCORE", s.rankScore == null ? "–" : String(Math.round(s.rankScore))], ["THAT DAY", s.dayRank ? `${s.dayRank.pos} of ${s.dayRank.of} · ${s.dayRank.day}` : "–"],
        ["TYPE", s.type.toUpperCase()], ["BASIS", (s.basis ?? "–").toUpperCase()], ["HAPPENED", day(s.happenedAt)], ["BUILT", day(s.createdAt)]] as const).map(([k, v]) => <div key={k} className="min-w-0 border-b border-r border-rule p-3"><dt className="label text-compare-muted">{k}</dt><dd className="mt-1 break-words">{v}</dd></div>)}</dl>
      <DataTable caption="Score parts" head={["Part", "Value", "Why"]} rows={s.components.map(c => [c.label, c.value == null ? "–" : String(c.value), c.why || "–"])} />
      <div className="space-y-1 p-3"><p><span className="label text-compare-muted">WHY IT {s.state === "published" ? "RAN" : "WAS HELD"} · </span>{s.state === "published" ? s.whyRan : s.heldReason ?? s.reason}</p>
        {s.killReason && <p><span className="label text-compare-muted">RETIRED · </span>{s.killReason}</p>}
        {s.correctedAt && <p className="label text-compare-muted">CORRECTED {day(s.correctedAt)}</p>}</div>
    </Band>
    <Band title={`THE CHANGES BEHIND IT · ${s.changes.length}`}>
      {s.changes.length ? <DataTable caption="Changes with raw fields" head={["Change", "Captured", "Brand", "Page", "Type", "Before", "After", "Confirmed", "Record"]} pitch={i => ({ kind: "change", ref: String(s.changes[i]!.id) })}
        rows={s.changes.map(c => { const d = changeDates({ before: c.seen?.before, after: c.seen?.after, at: c.detected_at, confirmed: c.confirmed }); return [String(c.id), d.captured, c.domain, `${c.page_type}/${c.viewport}`, c.type, <ChangeValues key="b" value={c.before} />, <ChangeValues key="a" value={c.after} />, c.confirmed ? d.confirmed : c.line.split(" · ").slice(1).join(" · ") || "not confirmed",
          <Lnk key="r" href={`${brandDataPath(c.domain)}&page_type=${c.page_type}&viewport=${c.viewport}${c.snapshot_id ? `&a=${c.snapshot_id}` : ""}${c.prev_snapshot_id ? `&b=${c.prev_snapshot_id}` : ""}`}>COMPARE →</Lnk>]; })} />
        : <P>This story is not built from brand changes{s.sourceIds.length ? `; its sources: ${s.sourceIds.join(", ")}` : ""}.</P>}
    </Band>
    <Band title="FACTS SHEET">
      <DataTable caption="The facts the story states" head={["Fact", "Kind", "Basis", "Receipt"]} rows={s.facts.map(f => [f.text, f.kind ?? "–", (f.basis ?? "–").toUpperCase(), f.href ? <Lnk key="h" href={f.href}>OPEN →</Lnk> : "–"])} />
      <p className="label p-3 text-compare-muted">BRANDS {s.domains.join(", ") || "–"} · SIGNALS {s.signals.map(k => label(k).name).join(", ") || "–"} · SECTOR {s.sector ?? "–"}</p>
    </Band>
    <Band title={`TEXT VERSIONS · ${s.texts.length}`}>
      <DataTable caption="Written versions (each passed the writer's check when stored) and the template" head={["Version", "Stored", "Model", "Headline", "Deck", "Shown"]}
        rows={[...s.texts.map(t => [`v${t.version}`, day(t.created_at), t.model, t.headline, t.deck, t.shown ? "YES" : "–"]), ["Template", "–", "code", s.template.headline, s.template.deck ?? "–", s.texts.some(t => t.shown) ? "–" : "YES"]]} />
    </Band>
    <Band title={`PICTURES · ${s.pictures?.rows.length ?? 0}`}>
      {s.pictures ? <>
        <p className="label p-3 text-compare-muted">LEAD {s.pictures.kind.toUpperCase()} · {s.pictures.rule}{s.pictures.caption ? ` · ${s.pictures.caption}` : ""} · CHOSEN BY {s.pictures.chosen ? `${s.pictures.chosen.by.toUpperCase()}: ${s.pictures.chosen.reason}` : "THE RULE"}</p>
        {s.pictures.rows.length > 0 && <DataTable caption="The lead picture's pictures, each the brand's own published page" head={["Brand", "Section", "Captured", "Role", "Stored object", "Chosen by", "Record"]}
          rows={s.pictures.rows.map(r => [r.brand, r.section, r.captured, r.role ? r.role.toUpperCase() : "–", <a key="o" href={r.src} className="text-ink underline underline-offset-2">{r.asset}</a>, r.chosen_by, <Lnk key="r" href={brandDataPath(r.brand)}>RECEIPT →</Lnk>])} />}
      </> : <P>The picture lookup failed; the Read view shows its fallback.</P>}
    </Band>
    <Band title={`EDITOR'S LOG · ${s.edits.length}`}>
      {s.edits.length ? <DataTable caption="Edits applied to this story" head={["When", "Action", "Note"]} rows={s.edits.map(e => [day(e.at), e.action.toUpperCase(), e.note ?? "–"])} /> : <P>No edits: the story runs as built.</P>}
    </Band>
  </>;
}

// BRAND --------------------------------------------------------------------------------------------------------------------------
/** W3b · one line under the band's own title: thumbnail (inside 64 px), the work's title (the only link, to the museum's page; the full
 *  credit is its tooltip), the museum, artist and date, and the measured distance. Clamped to two lines so it never turns into a block. */
export function MuseumLine({ a }: { a: ArtNear }) {
  return <p className="flex items-center gap-3 p-3" data-nearest-art="">
    {a.thumb && <img src={a.thumb} width={a.width} height={a.height} loading="lazy" decoding="async" alt="" className="block shrink-0 border" style={{ width: a.width, height: a.height }} />}
    <span className="line-clamp-2 min-w-0 text-compare-muted"><a href={a.href} target="_blank" rel="noopener" title={a.line} className="text-ink underline underline-offset-2">{a.title}</a> · {a.short}{a.credit ? ` · ${a.credit}` : ""} · distance {a.distance.toFixed(3)}</span>
  </p>;
}
/** W3c · the brand's accent held by a stored work, as one line (two at most at 390 px): the accent swatch, the thumbnail inside 64 px,
 *  "This {family} is in" the title (the only link, the full credit its tooltip and read to screen readers), artist and date (from 640 px),
 *  and the share the colour holds of the picture. */
export function AccentLine({ a }: { a: AccentNear }) {
  return <p className="flex items-center gap-3 p-3" data-accent-art="">
    <span className="block h-4 w-4 shrink-0 border" style={{ background: a.accent }} title={`Accent ${a.accent}`} aria-hidden="true" />
    {a.thumb && <img src={a.thumb} width={a.width} height={a.height} loading="lazy" decoding="async" alt="" className="block shrink-0 border" style={{ width: a.width, height: a.height }} />}
    <span className="line-clamp-2 min-w-0 text-compare-muted">This {a.family} is in <a href={a.href} target="_blank" rel="noopener" title={a.credit} className="text-ink underline underline-offset-2">{a.title}<span className="sr-only"> ({a.credit})</span></a>{a.artistDate ? <span className="hidden sm:inline"> · {a.artistDate}</span> : null} · holds {Math.round(a.share * 100)}% of the picture</span>
  </p>;
}
export function BrandData({ domain }: { domain: string }) {
  // C1 · the placeholder reaches past the screen, so the record landing never pushes the footer bar (it moved by 0.02).
  return <Later id="brand-data-later" reserve="100dvh" shapes={[{ kind: "block", height: 96 }, ...rowsShape(8)]}><BrandDataBody domain={domain} /></Later>;
}
function BrandDataBody({ domain }: { domain: string }) {
  const { data } = useSuspenseQuery(librarySiteQuery(domain)), { data: s } = useSuspenseQuery(brandSurfacesQuery(domain)), { data: card } = useSuspenseQuery(brandCardQuery(domain));
  if (!data) return <DataNote>Not in the library: only tracked brands have a record.</DataNote>;
  // W3b · nothing of the museum while MUSEUM_SHOWN is false.
  const art = MUSEUM_SHOWN ? card?.art ?? null : null, accentArt = MUSEUM_SHOWN ? card?.accentArt ?? null : null;
  return <>
    <LibrarySite domain={domain} embedded />
    {/* W3b · the nearest museum work as one line (at most two at 390 px), a thumbnail inside 64 px, only the title linked. Off while MUSEUM_SHOWN is false. */}
    {art && <Band title="NEAREST MUSEUM WORK"><MuseumLine a={art} /></Band>}
    {/* W3c · the stored work that holds this brand's accent, one line, sent with the card (never late). Off while MUSEUM_SHOWN is false. */}
    {accentArt && <Band title="ACCENT IN THE MUSEUM"><AccentLine a={accentArt} /></Band>}
    {/* W1b · every surface side by side with the homepage, then every stored icon and card version with its verdict. */}
    {s.rows.length > 0 && <Band title="SURFACES">
      <DataTable caption="Latest live desktop capture of each page, measured fields side by side" head={["Surface", ...s.fieldNames, "Captured", "Address", "Matches home"]}
        rows={s.rows.map(r => [r.page, ...s.fieldNames.map(f => r.fields[f] ?? "not measured"), r.at.slice(0, 10), r.url ? <Lnk key="u" href={r.url}>{r.url.replace(/^https?:\/\//, "")}</Lnk> : "–", r.match === "this is home" ? "–" : r.match])} />
      {s.productLine && <p className="p-3 text-compare-muted">{s.productLine}</p>}
    </Band>}
    {/* J1 · the stored structure record, raw, desktop and phone (newest well-read quarter). */}
    <Later shapes={rowsShape(4)}><StructureRaw domain={domain} /></Later>
    {s.history.length > 0 && <Band title="ICON AND CARD HISTORY">
      <DataTable caption="Every stored version of the site icon and social card, oldest first" head={["Picture", "Version", "First seen", "Last seen", "Against the previous version", "Receipt"]}
        rows={s.history.map(h => [h.kind, String(h.version), h.first.slice(0, 16).replace("T", " "), h.last.slice(0, 16).replace("T", " "), assetVerdictText(h.verdict), <Lnk key="r" href={h.src}>PICTURE →</Lnk>])} />
    </Band>}
  </>;
}

// SIGNAL -------------------------------------------------------------------------------------------------------------------------
export function SignalData({ k }: { k: string }) {
  const { dimension, value } = split(k);
  return <Later id="signal-data-later" shapes={rowsShape(8)}><div className="p-3"><div className="mb-3 flex justify-end"><StoryLink row={{ signal: k }} /></div><Detail dimension={dimension} value={value} /></div></Later>;
}
/** The drawer content once its rows are in (suspends first, so the server and the browser draw the same thing). */
function Detail({ dimension, value }: { dimension: string; value: string }) {
  useSuspenseQuery(forecastDetailQuery(dimension, value)); useSuspenseQuery(signalsQuery());
  return <><TraitDetail dimension={dimension} value={value} explainer={false} /><WhyNow kind="signal" id={`${dimension}:${value}`} data /></>;
}

// PATTERN ------------------------------------------------------------------------------------------------------------------------
export function PatternData({ k, sector }: { k: string; sector: string }) {
  return <Later id="pattern-data-later" shapes={rowsShape(6)}><PatternDataBody k={k} sector={sector} /></Later>;
}
function PatternDataBody({ k, sector }: { k: string; sector: string }) {
  const { data } = useSuspenseQuery(patternsQuery(sector)), { data: sig } = useSuspenseQuery(signalsQuery());
  const p = data.patterns.find(x => x.key === k), tracked = sig?.signals.some(x => x.key === k);
  return <>
    <Band title="PATTERN">
      {p ? <><DataTable caption="The terminal's pattern row" head={["Pattern", "Dimension", "Basis", "Stage", "Momentum", "Confidence", "Brands", "Story"]} pitch={() => ({ kind: "signal", ref: k })}
        rows={[[p.name, p.dimension, <BasisChip key="b" basis={p.basis} />, <StageBadge key="s" stage={p.stage} />, String(p.momentum_index ?? "–"), p.confidence.toUpperCase(), String(p.examples), <StoryLink key="n" row={{ signal: k }} />]]} />
        <DataTable caption="Example brands" head={["Brand", "Record"]} pitch={i => ({ kind: "brand", ref: p.sample[i]! })} rows={p.sample.map(d => [d, <Lnk key="r" href={brandDataPath(d)}>DATA →</Lnk>])} /></>
        : <DataNote>Not in the terminal's pattern list {sector !== "all" ? "for this sector" : "yet"}: it needs enough example brands. What we track for it is below.</DataNote>}
    </Band>
    {tracked ? <Band title="SIGNAL DETAIL"><div className="p-3"><Detail {...split(k)} /></div></Band>
      : <DataNote>No forecast rows for this pattern: it is tracked as a pattern only (its examples and share sit on the Read view).</DataNote>}
  </>;
}

// STUDY --------------------------------------------------------------------------------------------------------------------------
export function StudyData({ slug }: { slug: string }) {
  return <Later id="study-data-later" shapes={rowsShape(8)}><StudyDataBody slug={slug} /></Later>;
}
function StudyDataBody({ slug }: { slug: string }) {
  const search = useSearch({ strict: false });
  const { data: d } = useSuspenseQuery(dataStoryQuery(slug)), { data: x } = useQuery(studyDataQuery(slug));
  if (d.kind !== "live") return <DataNote>{d.kind === "draft" ? `This study is not live: ${d.reason ?? "its check does not pass yet"}.` : "No such study."}</DataNote>;
  const s = d.story, sheet = factsSheet(s), lens = resolveSector((search as Record<string, unknown>)["sector"]), sector = lens === "all" ? null : lens;
  return <>
    <Band title="FACTS SHEET">
      <DataTable caption="The sheet the writer sees, scene by scene" head={["Scene", "Fact"]} rows={sheet.scenes.flatMap(sc => sc.facts.map(f => [sc.id, f]))} csv={{ name: `${slug}-facts`, rows: sheet.scenes.flatMap(sc => sc.facts.map(f => [sc.id, f])) }} />
      <DataTable caption="Numbers the text may use" head={["Scene", "Number", "Value", "Receipt"]} rows={sheet.scenes.flatMap(sc => sc.numbers.map(n => [sc.id, n.text, String(n.value), <Lnk key="h" href={n.href}>OPEN →</Lnk>]))} csv={{ name: `${slug}-numbers`, rows: sheet.scenes.flatMap(sc => sc.numbers.map(n => [sc.id, n.text, String(n.value), n.href])) }} />
      <p className="label p-3 text-compare-muted">FINGERPRINT {s.hash} · LIMITS {sheet.limits.join(" · ") || "–"}</p>
    </Band>
    <Band title="THE DATA BEHIND EACH FIGURE">
      {Object.entries(s.figures).flatMap(([id, f]) => lensedFigureTables(f, sector).map((t, i) => <DataTable key={`${id}-${i}`} id={i === 0 ? `fig-${id}` : undefined} caption={t.lens ? `${t.caption} · ${t.lens}` : t.caption} head={t.head} rows={t.rows} csv={{ name: `${slug}-${id}${i ? `-${i + 1}` : ""}`, rows: t.rows }}
        tools={<Lnk href={consoleHref(studyCommand(slug, id, i + 1), sector)}>Open in console</Lnk>} />))}
    </Band>
    <Band title="THE CHECK THAT KEEPS IT LIVE">
      {!x ? <P>Loading the check…</P> : !x.check ? <P>This study has no live check.</P> : <>
        <p className="p-3">{x.check.pass == null ? x.check.reason : x.check.pass ? "Passes on current data." : `Fails on current data: ${x.check.reason}`}</p>
        <DataTable caption={`Check ${x.check.id}`} head={["Figure", "Now", "Needs", "When set live"]} rows={x.check.figures.map(f => [f.label, String(f.value), String(f.need), String(x.check!.recorded[f.id] ?? "–")])} csv={{ name: `${slug}-check`, rows: x.check.figures.map(f => [f.label, String(f.value), String(f.need), String(x.check!.recorded[f.id] ?? "")]) }} />
      </>}
    </Band>
    <Band title="TEXT VERSIONS">
      {!x ? <P>Loading versions…</P> : <DataTable caption="Stored written versions, newest first" head={["Stored", "Fingerprint", "Model", "Checked", "Headline", "Current"]}
        rows={[...x.versions.map(v => [day(v.created_at), v.facts_hash, v.model, v.checked_at ? "PASSED" : "FAILED", v.headline, v.facts_hash === s.hash && v.checked_at ? "YES" : "–"]), ...(s.text.source === "fallback" ? [["–", "–", "template", "–", s.text.headline, "YES (template)"]] : [])]} />}
    </Band>
  </>;
}

// WEEK ---------------------------------------------------------------------------------------------------------------------------
export function WeekData({ issue }: { issue: Edition }) {
  return <>
    <Band title={`THE ISSUE · ${issue.rows.length} STORIES`}>
      <DataTable caption="The stories this issue reports" head={["Story", "Subject", "Kind", "When", "Headline"]} rows={issue.rows.map(r => [r.number != null ? <Lnk key="n" href={r.href}>No. {r.number}</Lnk> : "–", r.subject, r.kind, r.when ?? "–", r.headline])} />
      <p className="label p-3 text-compare-muted">COVER No. {issue.cover.number ?? "–"} · {issue.cover.why.toUpperCase()} · {issue.words} WORDS · TEXT {issue.text.source.toUpperCase()}</p>
    </Band>
    <Later id="week-data-later" shapes={rowsShape(6)}><WeekBrief week={issue.week} /></Later>
  </>;
}
function WeekBrief({ week }: { week: string }) {
  const { data } = useSuspenseQuery(weekDataQuery(week)), router = useRouter();
  if (!data) return <Band title="THE STORED WEEKLY BRIEF"><DataNote>No weekly brief was stored for this week.</DataNote></Band>;
  const movers = briefMovers(data.brief);
  return <Band title={`THE STORED WEEKLY BRIEF · ${week}`}>
    <BriefWithdrawn week={week} className="border-b border-rule p-3" />
    <BriefView brief={data.brief} onTrait={id => void router.navigate({ href: dataHref({ type: "signal", id: id.replace(/:all$/, "") }) })} />
    <DataTable caption="Every item the brief cites" head={["Section", "Kind", "What", "Open"]} rows={movers.map(m => [m.section, m.kind, m.what, m.href ? <Lnk key="o" href={m.href}>OPEN →</Lnk> : "–"])} csv={{ name: `brief-${week}`, rows: movers.map(m => [m.section, m.kind, m.what, m.href ?? ""]) }} />
    <p className="label p-3 text-compare-muted">STORED {day(data.at)} · MODEL {show(data.model)}</p>
  </Band>;
}

function StructureRaw({ domain }: { domain: string }) {
  const { data } = useSuspenseQuery(brandStructureQuery(domain));
  const rows = [["Desktop", data.desktop], ["Phone", data.phone]] as const;
  return <Band title="PAGE STRUCTURE">
    {!data.desktop && !data.phone ? <p className="p-3 text-compare-muted">{NOT_READ}</p> : rows.map(([k, v]) => v && <details key={k} className="border-b border-rule p-3" data-structure-raw={k}>
      <summary className="label cursor-pointer">{k.toUpperCase()} · {v.source} · {v.captured_at.slice(0, 16).replace("T", " ")} UTC</summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-label">{JSON.stringify(v.record, null, 1)}</pre>
    </details>)}
  </Band>;
}
