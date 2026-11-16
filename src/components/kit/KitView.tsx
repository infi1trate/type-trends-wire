// /kit: every shared component on live data, in the current theme, with light / dark / vibes side by side where mode matters.
// A brand direction is judged here: change the theme file, reload this page.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { kitQuery, signalSeriesQuery } from "@/lib/data";
import { KIT_SECTIONS, CONTAINERS, type ContainerStyle } from "@/lib/kit";
import { ACTIVE_THEME, activeTheme, flatten, TYPE_ROLES, type Mode, type TypeRoleName } from "@/lib/theme";
import { STAGES } from "@/lib/labels";
import { brandPath, signalPath } from "@/lib/ia";
import { pct } from "@/lib/digest/copy";
import { BRAND_LINE, BRAND_NAME } from "@/lib/brand";
import { DigestShell, StageWord, BasisWord } from "@/components/digest/Editorial";
import { ReadFooter, Spark } from "@/components/read/Bits";
import { StoryCard, StoryRow, Receipt } from "@/components/read/StoryCard";
import { Treated, TREATMENTS, TREATMENT_NOTE } from "@/components/read/Treated";
import { NextCheck } from "@/components/read/Freshness";
import { Wordmark } from "@/components/brand/Wordmark";
import { StageBadge } from "@/components/terminal/Info";
import { BasisChip, TierChip } from "@/components/terminal/SignalBits";
import { Ticker } from "@/components/terminal/Chrome";
import { BarChart, DonutChart, LineChart, ScatterChart } from "@/components/charts/Charts";
import { DataKitExamples } from "@/components/data/KitExamples";
import { CONTAINER_RULES, Plate, Slab } from "@/components/brand/Containers";
import { Button, Byline, Container, LiveChip, LiveStamp, ModePanels, SearchInput, Segmented, Tabs, TickValue } from "./Parts";

const SAMPLE: Record<TypeRoleName, string> = {
  wordmark: "", mast: "The Digest", display: "Where the opening is", h1: "Scroll-driven animation breaks out", h2: "The week in stories", h3: "A palette moves to warm neutrals", h4: "Section heading",
  kicker: "Kicker · shift", deck: "Stage and share against all sectors, with receipts.", "body-lg": "Large body for standfirsts and leads.", body: "Body copy for stories and explainers, set for long reading.",
  small: "Small text for card decks and notes.", caption: "Caption · captured 2026-11-15", quote: "“Every number carries its receipt.”", figure: "27.6%", stat: "+1.3", data: "DATA 0123456789", chip: "Measured", specimen: "Aa",
};
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
const share = (v: number) => pct(v, 1) ?? "—";
const COLOR_GROUPS = ["surface", "text", "rule", "accent", "on-accent", "stage", "mark", "focus-ring", "selection"] as const;

function Section({ id, title, children, note }: { id: string; title: string; children: React.ReactNode; note?: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="ed-wrap mt-16">
    <h2 id={`${id}-h`} className="ed-h2 ed-rule pt-3">{title}</h2>
    {note && <p className="ed-small ed-muted mt-2 max-w-[72ch]">{note}</p>}
    <div className="mt-6">{children}</div>
  </section>;
}
function Swatches({ mode }: { mode: Mode }) {
  const vars = flatten(activeTheme, mode);
  const groups = COLOR_GROUPS.map(g => [g, Object.keys(vars).filter(k => k.startsWith(`--tk-${g}-`) || k === `--tk-${g}`).filter(k => g !== "focus-ring" || k === "--tk-focus-ring")] as const);
  return <div className="space-y-4">{groups.map(([g, keys]) => <div key={g}>
    <p className="tk-t-kicker tk-c-muted">{g}</p>
    <ul className="mt-1 grid grid-cols-2 gap-2">{keys.map(k => <li key={k} className="flex min-w-0 items-center gap-2">
      <span className="inline-block h-8 w-8 shrink-0 border" style={{ background: `var(${k})`, borderColor: "var(--tk-rule-hairline)" }} aria-hidden="true" />
      <span className="tk-t-caption min-w-0 break-all">{k.replace("--tk-", "")}<span className="tk-c-muted block">{vars[k]}</span></span>
    </li>)}</ul>
  </div>)}</div>;
}
function TypeRoles({ mode }: { mode: Mode }) {
  const t = activeTheme.modes[mode].type;
  return <ul className="space-y-4">{TYPE_ROLES.map(r => <li key={r} className="min-w-0 overflow-hidden">
    {r === "wordmark" ? <Wordmark height={48} ground="auto" /> : <p className={`tk-t-${r} break-words`}>{SAMPLE[r]}</p>}
    <p className="tk-t-caption tk-c-muted mt-1">{r} · {t[r].family} {t[r].weight} · {t[r].size}{t[r].sizeMd ? ` → ${t[r].sizeMd}` : ""}{t[r].sizeXl ? ` → ${t[r].sizeXl}` : ""} / {t[r].leading}{t[r].case !== "none" ? ` · ${t[r].case}` : ""}{t[r].style !== "normal" ? ` · ${t[r].style}` : ""}</p>
  </li>)}</ul>;
}
function Controls() {
  const [mode, setMode] = useState("Read");
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3"><Button variant="primary">Primary</Button><Button variant="secondary">Secondary</Button><Button variant="raised">Raised</Button><Button variant="link">Text link</Button></div>
    <div className="flex flex-wrap items-center gap-2">{STAGES.map(s => <StageWord key={s} stage={s} />)}<BasisWord b="measured" /><BasisWord b="ai" /><LiveChip /></div>
    <div className="flex flex-wrap items-center gap-2"><span className="tk-t-caption tk-c-muted">Terminal:</span><StageBadge stage="Rising" /><BasisChip basis="measured" /><BasisChip basis="ai" /><TierChip tier="headline" /></div>
    <SearchInput />
    <Segmented label="Mode" options={["Read", "Terminal"]} value={mode} onChange={setMode} />
    <Tabs label="Signal tabs" tabs={["Headline", "Decisions", "Everything"]}>{t => <p className="tk-t-small">{t} tab content.</p>}</Tabs>
    <Byline at={new Date(Date.UTC(2026, 10, 15, 21, 35)).toISOString()} basis="Measured" sites={300} />
    <p className="tk-t-data"><Receipt href="/what-we-show" className="tk-tap underline">Receipts →</Receipt></p>
    <div className="min-w-0 overflow-hidden"><Ticker /></div>
  </div>;
}
function SignalLine({ k, name, stage, share: s, points }: { k: string; name: string; stage: (typeof STAGES)[number] | null; share: number | null; points: number[] | undefined }) {
  return <li className="ed-hair py-2">
    <Receipt href={signalPath(k)} className="tk-t-h4 block break-words no-underline hover:underline">{name}</Receipt>
    <span className="mt-1 flex min-h-11 flex-wrap items-center gap-3"><StageWord stage={stage} /><span className="tk-t-data">{s == null ? "—" : share(s)}</span><Spark points={points} label={name} /></span>
  </li>;
}

export function KitView() {
  const { data: d } = useSuspenseQuery(kitQuery());
  const { data: series } = useQuery(signalSeriesQuery("all"));
  const [lead, standard, ...rest] = d.stories;
  const c = d.charts;
  return <DigestShell label="Kit" section="tools">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Tools · design kit</p>
      <h1 className="ed-cover mt-3">The kit</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">Every shared component on live data, in the current theme ({activeTheme.label}). Light, dark and vibes sit side by side where the mode matters. The rules behind them are on the brand pages.</p>
      <nav aria-label="Kit sections" className="ed-data mt-6 flex flex-wrap gap-x-5">{KIT_SECTIONS.map(s => <a key={s.id} href={`#${s.id}`} className="ed-tap">{s.title}</a>)}</nav>
      <p className="ed-data mt-3"><Link to="/brand" className="ed-tap">The brand: the rules behind every part here →</Link></p>
      <p className="ed-caption mt-2">Theme “{ACTIVE_THEME}” · forecast run {d.run_id ?? "—"} · {d.published} published stories · {d.composites} composite signals</p>
    </header>

    <Section id="kit-type" title={KIT_SECTIONS[0].title} note={`The mark is the kit's outlined drawing of “${BRAND_NAME}”, always brand ink; in dark mode it sits on its pink slab. Product line: ${BRAND_LINE}.`}>
      <ModePanels>{m => <TypeRoles mode={m} />}</ModePanels>
    </Section>
    <Section id="kit-colour" title={KIT_SECTIONS[1].title} note="Semantic tokens only, named by role. Values shown per mode; “currentColor” means the chip takes the surrounding text colour.">
      <ModePanels>{m => <Swatches mode={m} />}</ModePanels>
    </Section>
    <Section id="kit-controls" title={KIT_SECTIONS[2].title} note="Buttons, chips (stage, MEASURED, AI ESTIMATE, LIVE), search, the Read / Terminal switch, tabs, byline, receipt and the ticker.">
      <ModePanels>{() => <Controls />}</ModePanels>
    </Section>
    <Section id="kit-stories" title={KIT_SECTIONS[3].title} note="Story cards (lead, standard, compact), a signal row with its sparkline, a brand lockup and the live timestamp, from today's data.">
      <ModePanels>{() => <div className="space-y-6">
        {lead ? <StoryCard s={lead} lead /> : <p className="ed-small">No published stories yet.</p>}
        {standard && <StoryCard s={standard} />}
        {rest.length > 0 && <ul className="border-y border-rule">{rest.slice(0, 3).map((s, i) => <StoryRow key={s.id} s={s} n={i + 1} />)}</ul>}
        <ul>{d.signals.map(s => <SignalLine key={s.key} k={s.key} name={s.name} stage={s.stage} share={s.share} points={series?.[s.key]} />)}</ul>
        {d.brand && <div className="ed-hair pt-3"><p className="tk-t-kicker tk-c-muted">Brand</p><p className="tk-t-h3"><Receipt href={brandPath(d.brand)} className="no-underline hover:underline">{d.brand}</Receipt></p></div>}
        <LiveStamp at={d.computed_at} /><p className="ed-caption"><NextCheck /></p>
      </div>}</ModePanels>
    </Section>
    <Section id="kit-containers" title={KIT_SECTIONS[4].title} note="The brand's eight containers, with their rules built in. A hard shadow exists only on Raised and Sticker; only Sticker is round. Rules: /brand/containers.">
      <ModePanels>{() => <div className="grid grid-cols-1 gap-4">{CONTAINERS.map(k => <div key={k}><Container kind={k} /><p className="ed-caption mt-1">{CONTAINER_RULES[k].use}</p></div>)}</div>}</ModePanels>
    </Section>
    <Section id="kit-images" title={KIT_SECTIONS[5].title} note={d.crop ? `On the latest stored crop (${d.crop.domain}); credit and links are unchanged under every treatment. Pages use “none”.` : "No section crops are stored yet, so each treatment is shown on the placeholder state with a generated specimen. Pages use “none”."}>
      <ModePanels>{() => <div className="grid grid-cols-1 gap-6">{TREATMENTS.map(t => <div key={t}><Treated crop={d.crop} treatment={t} label={t} sizes="(min-width: 1024px) 30vw, 100vw" /><p className="ed-caption ed-muted mt-1">{TREATMENT_NOTE[t]}</p></div>)}</div>}</ModePanels>
    </Section>
    <Section id="kit-charts" title={KIT_SECTIONS[6].title} note="Four primitives on one frame: title, one-line note, source and receipt. Points take keyboard focus; a table carries the same numbers for screen readers.">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ScatterChart title="Share against Momentum" note={`The ${c.scatter.length} composite signals, all sectors.`} source={`forecast run ${d.run_id ?? "—"}`} receipt={{ href: "/what-we-show", label: "How composites work" }} points={c.scatter} x={{ label: "Share", format: share }} y={{ label: "Momentum (pts/q)", format: signed }} />
        <LineChart title="Two composites over time" note="Share by quarter, well-covered quarters only (15+ sites, 25%+ coverage)." source={`forecast run ${d.run_id ?? "—"}`} receipt={c.lines[0] ? { href: signalPath(c.lines[0].id), label: "Signal page" } : undefined} series={c.lines} y={{ label: "Share", format: share }} />
        <BarChart title="Most common composites" note="The six composite signals with the highest share, all sectors." source={`forecast run ${d.run_id ?? "—"}`} receipt={{ href: "/signals", label: "All signals" }} bars={c.bars} format={share} valueLabel="Share" />
        <DonutChart title="Published stories by type" note={`Every published story in the reading window (${d.published}).`} source="stored stories, edits applied" receipt={{ href: "/", label: "Read the stories" }} slices={c.slices} unit="stories" />
      </div>
      <div className="mt-12"><ModePanels>{() => <ScatterChart title="Share against Momentum" note="The same chart in each mode." source={`forecast run ${d.run_id ?? "—"}`} points={c.scatter} x={{ label: "Share", format: share }} y={{ label: "Momentum (pts/q)", format: signed }} />}</ModePanels></div>
    </Section>
    <Section id="kit-space" title={KIT_SECTIONS[7].title} note="The spacing scale, then a quiet page and a loud page built only from tokens.">
      <ul className="space-y-2">{([1, 2, 3, 4, 5, 6, 7] as const).map(n => <li key={n} className="flex items-center gap-3"><span className="tk-t-caption w-24">space-{n} · {activeTheme.shared.space[n]}</span><span className="tk-space-bar" style={{ width: `var(--tk-space-${n})` }} aria-hidden="true" /></li>)}</ul>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div data-mode="light" className="tk-panel" aria-label="Quiet page skeleton" role="group" style={{ padding: "var(--tk-space-6) var(--tk-space-5)" }}>
          <p className="tk-t-kicker tk-c-muted">Quiet</p><p className="tk-t-h2" style={{ marginTop: "var(--tk-space-5)" }}>One idea per screen</p>
          <p className="tk-t-small tk-c-secondary" style={{ marginTop: "var(--tk-space-4)", maxWidth: "var(--tk-layout-measure)" }}>Generous margins, one hairline, nothing competing.</p>
          <div style={{ marginTop: "var(--tk-space-6)", borderTop: "var(--tk-border-hairline) solid var(--tk-rule-hairline)" }} />
        </div>
        <div className="tk-panel" aria-label="Loud page skeleton" role="group" style={{ padding: 0 }}>
          <Slab className="p-4"><p className="tk-t-kicker">Loud</p><p className="tk-t-display">Breaking out</p></Slab>
          <Plate><p className="tk-t-stat">+4.2</p><p className="tk-t-small">points a quarter</p></Plate>
        </div>
      </div>
    </Section>
    <Section id="kit-motion" title={KIT_SECTIONS[8].title} note={`The live tick pulses every ${activeTheme.shared.motion.tick} and a changing value flashes the accent. With reduced motion on, the dot holds still and values change without the flash.`}>
      <ModePanels>{() => <div className="flex flex-wrap items-center gap-6"><LiveChip /><TickValue /><span className="tk-t-caption tk-c-muted">fast {activeTheme.shared.motion.fast} · base {activeTheme.shared.motion.base} · slow {activeTheme.shared.motion.slow}</span></div>}</ModePanels>
    </Section>
    <Section id="kit-data" title={KIT_SECTIONS[9].title} note="The six data story views on fixture data: adoption timeline, before and after, small multiples, brand field, palette drift and the strip. Captures are redrawn from stored layout boxes until crops exist.">
      <DataKitExamples />
    </Section>
    <ReadFooter terminal="/terminal?panel=watch" />
  </DigestShell>;
}
