// The brand pages (/brand/*): live pages built from the real tokens and components, not pictures of them. Quiet density: one idea
// per screen, the left third holds a label, generous air above each title; the rules are short sentences from brand/README.md.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { kitFilesQuery, kitQuery } from "@/lib/data";
import { activeTheme, BRAND_KIT, COMPARISON_THEMES, flatten, type Mode } from "@/lib/theme";
import { contrast, ratioText, AA } from "@/lib/theme/contrast";
import { BRAND_PAGES, BRAND_INTRO, MARK_RULES, COLOUR_ROLES, SUPPORTING, CONTRAST_AGAINST_INK, COLOUR_NOTES, TYPE_RULES, TYPE_FACES, TYPE_LADDER, CONTAINER_LAWS,
  SPACE_RULES, DENSITY_NOTES, ILLUSTRATION_RULES, ILLUSTRATION_STYLES, MOTION_RULES, MOTION_PATTERNS, sizeText, type BrandPageSlug } from "@/lib/brand-pages";
import { STAGES } from "@/lib/labels";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell, StageWord, BasisWord } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { Wordmark, Monogram } from "@/components/brand/Wordmark";
import { MARK_PATHS } from "@/components/brand/mark.gen";
import { MARK_INK, CUT_MIN_PX, X_HEIGHT, cutFor } from "@/components/brand/mark";
import { Card, Plate, Raised, RuleBox, Sheet, Slab, Sticker, PhotoPlate, CONTAINER_NAMES, CONTAINER_RULES } from "@/components/brand/Containers";
import { Ledger } from "@/components/brand/Ledger";
import { CutAndPaste, FiltersScope, HeadlineStrips, SoftObject, Trail } from "@/components/brand/Illustration";
import { Count, useGrow } from "@/components/brand/Motion";
import { MOTION_MS } from "@/lib/motion";
import { FRAME_LABEL, storyFrames } from "@/lib/stories/frames";
import { fxCapture } from "@/lib/data-stories/fixtures";
import { CaptureFrame } from "@/components/data/Figures";
import { ScrollRow } from "@/components/read/ScrollRow";

const K = BRAND_KIT, C = K.color;
const LIGHT = activeTheme.modes.light;

// ——— Layout ——————————————————————————————————————————————————————————————————————————————————————————
function BrandNav({ page }: { page: BrandPageSlug }) {
  return <nav aria-label="Brand pages" className="no-print border-b-[1.5px] border-ed-ink">
    <div className="ed-wrap"><ScrollRow className="ed-navtext gap-x-5">{BRAND_PAGES.map(p =>
      <a key={p.slug} href={p.path} aria-current={p.slug === page ? "page" : undefined} className={`-mb-[1.5px] inline-flex min-h-11 shrink-0 items-center border-b-[3px] no-underline ${p.slug === page ? "border-ed-ink" : "border-transparent"}`}>{p.title}</a>
    )}<Link to="/kit" className="inline-flex min-h-11 shrink-0 items-center no-underline">The kit (/kit) →</Link></ScrollRow></div>
  </nav>;
}
export function BrandShell({ page, children }: { page: BrandPageSlug; children: ReactNode }) {
  const p = BRAND_PAGES.find(x => x.slug === page)!;
  return <DigestShell label={`Brand: ${p.title}`} section="tools" edition={null}>
    <BrandNav page={page} />
    <header className="ed-wrap d-air d-quiet" data-brand-page={page || "index"}>
      <p className="d-quiet-label ed-kicker">Brand{page ? ` · ${BRAND_PAGES.findIndex(x => x.slug === page)} of ${BRAND_PAGES.length - 1}` : ""}</p>
      <div><h1 className="ed-cover">{p.title}</h1><p className="ed-standfirst mt-6">{p.line}</p></div>
    </header>
    {children}
    <nav aria-label="Next brand page" className="ed-wrap d-air">{(() => { const i = BRAND_PAGES.findIndex(x => x.slug === page), n = BRAND_PAGES[i + 1]; return n ? <Raised href={n.path}>Next: {n.title} →</Raised> : <Raised href="/brand">Back to the brand →</Raised>; })()}</nav>
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}
/** One idea per screen: air above, a label in the left third, the idea in the two thirds beside it. */
function Screen({ label, title, children, id, tall = false }: { label: string; title?: string; children: ReactNode; id: string; tall?: boolean }) {
  return <section aria-labelledby={`${id}-h`} className={`ed-wrap d-air ${tall ? "brand-screen-tall" : ""}`.trim()}>
    <div className="d-quiet">
      <p className="d-quiet-label ed-kicker" id={title ? undefined : `${id}-h`}>{label}</p>
      <div className="min-w-0">{title && <h2 id={`${id}-h`} className="ed-h2">{title}</h2>}<div className={title ? "mt-6" : ""}>{children}</div></div>
    </div>
  </section>;
}
const Rules = ({ rules }: { rules: readonly string[] }) => <ol className="ledger">{rules.map((r, i) => <li key={r} className="ledger-row grid grid-cols-[4.5ch_1fr] gap-x-4 py-3"><span className="ledger-num">{i + 1}</span><span className="ed-body">{r}</span></li>)}</ol>;
const Code = ({ children }: { children: ReactNode }) => <code className="ed-code">{children}</code>;
const Fact = ({ k, v }: { k: string; v: ReactNode }) => <div><dt className="ed-kicker">{k}</dt><dd className="ed-stat mt-1">{v}</dd></div>;
/** A live demo with a Raised replay button: replaying remounts the demo, so it plays once more from its first frame. With reduced
 * motion the demo rests on its last frame and the button still re-draws it. Nothing plays on load except what the page itself does. */
function Replay({ name, children }: { name: string; children: (played: boolean) => ReactNode }) {
  const [n, setN] = useState(0);
  return <div data-demo="">
    <div key={n} className="brand-demo">{children(n > 0)}</div>
    <p className="mt-4"><Raised onClick={() => setN(x => x + 1)} aria-label={`Replay: ${name}`}>Replay ↺</Raised></p>
  </div>;
}

// ——— /brand ————————————————————————————————————————————————————————————————————————————————————————
export function BrandOverview() {
  return <BrandShell page="">
    <Screen id="b-mark" label="The mark"><div className="brand-mark-full"><Wordmark height={240} /></div></Screen>
    <Screen id="b-idea" label="The idea" title={BRAND_INTRO.name}>
      <p className="ed-body">Approved {BRAND_INTRO.approved}. Paper and ink carry the brand; four inks do one job each; two families set the words and one utility face sets the code.</p>
    </Screen>
    <Screen id="b-pages" label="The pages" title="Eight pages, one idea each">
      <Ledger rows={BRAND_PAGES.slice(1).map((p, i) => ({ key: p.slug, href: p.path, number: i + 1, title: p.title, line: p.line }))} />
      <p className="ed-data mt-4"><Link to="/kit" className="ed-tap">Every shared component, on live data: the kit →</Link></p>
    </Screen>
    <Screen id="b-before" label="Before and after" title="The same story, two looks">
      <p className="ed-small mb-6">On the left, the legacy theme's colours and sizes (its faces are no longer loaded, so the browser substitutes). On the right, slug.</p>
      <BeforeAfterSample />
    </Screen>
  </BrandShell>;
}
function Sample() {
  return <div className="space-y-3"><p className="ed-kicker">No. 45 · White space · Dev tools</p><p className="ed-h3">Almost no dev tools brand uses lifestyle photography</p><p className="ed-small">It is rising everywhere else: this signal is past the experiment stage and spreading.</p><span className="ed-badge" data-stage="rising">Rising</span></div>;
}
function BeforeAfterSample() {
  // The legacy look renders from its own token values as inline variables, so the page never registers the legacy theme.
  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
    <figure><div className="c-card" style={legacyVars()} data-sample="legacy"><Sample /></div><figcaption className="ed-caption mt-2">Before: legacy</figcaption></figure>
    <figure><Plate><Sample /></Plate><figcaption className="ed-caption mt-2">After: slug</figcaption></figure>
  </div>;
}
let legacyCache: CSSProperties | null = null;
function legacyVars(): CSSProperties {
  // Imported lazily by value, not as a registered theme: only this comparison reads it.
  if (!legacyCache) legacyCache = LEGACY_VARS as CSSProperties;
  return { ...legacyCache, background: "var(--tk-surface-page)", color: "var(--tk-text-primary)", borderColor: "var(--tk-rule-strong)", borderWidth: "1px" };
}
const LEGACY_VARS = Object.fromEntries(Object.entries(flatten(COMPARISON_THEMES["legacy"]!, "light")).filter(([k]) => !k.startsWith("--tk-font"))) as Record<string, string>;

// ——— /brand/mark ———————————————————————————————————————————————————————————————————————————————————
/** A deliberately wrong mark for the "not this" cases. Never used outside this page. */
function WrongMark({ kind }: { kind: (typeof MARK_RULES.donts)[number]["id"] }) {
  const p = MARK_PATHS.standard, h = 56, w = (p.w / p.h) * h;
  if (kind === "typeset") return <span className="ed-h2 normal-case" style={{ fontFamily: "var(--tk-font-text)", textTransform: "none" }}>{BRAND_NAME}</span>;
  if (kind === "spacing") {
    const subs = p.d.match(/M[^M]*/g) ?? [], cuts = [p.w * 0.25, p.w * 0.42, p.w * 0.66];
    return <svg width={w * 1.3} height={h} viewBox={`0 0 ${p.w * 1.3} ${p.h}`} aria-hidden="true">{subs.map((d, i) => { const x = Number(d.slice(1).split(/[ Q]/)[0]); const k = cuts.filter(c => x > c).length; return <path key={i} d={d} fill={MARK_INK} transform={`translate(${k * p.w * 0.1} 0)`} />; })}</svg>;
  }
  const t = kind === "lean" ? `skewX(-14) translate(${p.h * 0.25} 0)` : kind === "stretch" ? "scale(1.35 1)" : undefined;
  const style: CSSProperties | undefined = kind === "glow" ? { filter: "drop-shadow(0 0 10px rgba(255,143,196,.9)) drop-shadow(0 6px 12px rgba(10,10,10,.45))" } : undefined;
  return <svg width={kind === "stretch" ? w * 1.35 : w * 1.1} height={h} viewBox={`0 0 ${kind === "stretch" ? p.w * 1.35 : p.w * 1.1} ${p.h}`} style={style} aria-hidden="true"><path d={p.d} fill={kind === "colour" ? C.pink : MARK_INK} transform={t} /></svg>;
}
const GROUND_HEX = { paper: C.paper, pink: C.pink, yellow: C.yellow, green: C.green } as const;
export function BrandMark() {
  const cuts = K.mark.cuts;
  return <BrandShell page="mark">
    <Screen id="m-full" label="The mark"><div className="brand-mark-full"><Wordmark height={320} /></div><p className="ed-caption mt-4">Display cut, drawn from the kit's outlined file. It is a drawing: the name is never set in a typeface.</p></Screen>
    <Screen id="m-build" label="Construction" title="Three notes">
      <div className="relative" data-construction="">
        <div className="brand-mark-full" style={{ background: C.yellow, padding: "6% 4%" }}><Wordmark height={200} ground="yellow" /></div>
        {[{ n: 1, x: "26%" }, { n: 2, x: "64%" }, { n: 3, x: "33%", bottom: true }].map(m => <span key={m.n} aria-hidden="true" className="ledger-num absolute flex h-10 w-10 items-center justify-center border-[3px] border-ed-ink bg-[var(--tk-surface-card)]" style={{ left: m.x, ...(m.bottom ? { bottom: "-20px" } : { top: "-20px" }) }}>{m.n}</span>)}
      </div>
      <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">{MARK_RULES.construction.map((c, i) => <li key={c.id}><p className="ledger-num">{i + 1}</p><h3 className="ed-h4 mt-2">{c.title}</h3><p className="ed-small mt-2">{c.text}</p></li>)}</ol>
    </Screen>
    <Screen id="m-clear" label="Clear space" title="Half the x-height, every side">
      <div className="inline-block border-[1.5px] border-dashed border-ed-ink" style={{ padding: `${200 * X_HEIGHT * 0.5}px` }} data-clearspace=""><Wordmark height={200} /></div>
      <p className="ed-body mt-4">{MARK_RULES.clear} At 200 px tall that is {200 * X_HEIGHT * 0.5} px; the slab around the mark on ink uses the same padding.</p>
    </Screen>
    <Screen id="m-cuts" label="Three cuts" title="Chosen by height">
      <div className="space-y-10">{([["display", 128], ["standard", 56], ["micro", 22]] as const).map(([cut, h]) => <div key={cut} className="ed-hair pt-4" data-cut-demo={cut}>
        <Wordmark height={h} />
        <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Fact k="Cut" v={cut} /><Fact k="From" v={`${CUT_MIN_PX[cut]} px`} /><Fact k="Slit" v={cuts[cut].slit} /><Fact k="Gap" v={cuts[cut].gap} />
        </dl>
        <p className="ed-small mt-2">{MARK_RULES.cuts[cut]} Shown at {h} px, so the component picks the {cutFor(h)} cut.</p>
      </div>)}</div>
    </Screen>
    <Screen id="m-s" label="The s, tiles and app icon" title="Where four letters will not fit">
      <div className="flex flex-wrap items-end gap-8">
        <Monogram height={120} />
        {(Object.keys(GROUND_HEX) as (keyof typeof GROUND_HEX)[]).map(g => <div key={g} className="flex h-28 w-28 items-center justify-center border-[3px] border-ed-ink" style={{ background: GROUND_HEX[g] }} data-tile={g}><Monogram height={60} ground={g} decorative /></div>)}
        <img src="/brand/files/slug-app-icon-1024.png" width={128} height={128} alt="The slug app icon: the s as a rounded pink object with a light and a hard shadow" />
      </div>
      <p className="ed-body mt-6">{MARK_RULES.s} {MARK_RULES.icon}</p>
    </Screen>
    <Screen id="m-grounds" label="Grounds" title="Where the mark may sit">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(GROUND_HEX) as (keyof typeof GROUND_HEX)[]).map(g => <li key={g} className="flex h-40 flex-col justify-between border-[3px] border-ed-ink p-4" style={{ background: GROUND_HEX[g] }}><Wordmark height={48} ground={g} /><span className="ed-kicker" style={{ color: C.ink }}>On {g}</span></li>)}
        <li className="flex h-40 flex-col justify-between border-[3px] border-ed-ink p-4" style={{ background: C.ink }}><Wordmark height={48} ground="ink" /><span className="ed-kicker" style={{ color: C.paper }}>On ink: the pink slab</span></li>
        <li className="brand-photo flex h-40 flex-col justify-between border-[3px] border-ed-ink p-4"><Wordmark height={48} ground="image" /><span className="ed-kicker self-start px-1" style={{ background: C.ink, color: C.paper }}>Over a photo: the paper slab (stand-in image)</span></li>
      </ul>
      <p className="ed-body mt-6">{MARK_RULES.grounds}</p>
    </Screen>
    <Screen id="m-donts" label="Not this" title="Six things the mark never does">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{MARK_RULES.donts.map(d => <li key={d.id} className="brand-dont c-card flex min-h-40 flex-col justify-between" data-dont={d.id}>
        <div className="flex min-h-20 items-center overflow-hidden"><WrongMark kind={d.id} /></div>
        <p className="ed-kicker mt-3"><span aria-hidden="true">✕ </span>Not this: {d.title}</p>
      </li>)}</ul>
    </Screen>
  </BrandShell>;
}

// ——— /brand/colour —————————————————————————————————————————————————————————————————————————————————
export function BrandColour() {
  const roles = K.role as Record<string, string>;
  return <BrandShell page="colour">
    <Screen id="c-bar" label="Proportion" title="How much of a page each colour takes">
      <div className="flex h-32 w-full border-[3px] border-ed-ink" role="img" aria-label={COLOUR_ROLES.map(r => `${r.name} ${r.share}%`).join(", ")} data-proportion="">
        {COLOUR_ROLES.map(r => <span key={r.id} className="h-full border-r-[1.5px] border-ed-ink last:border-r-0" style={{ width: `${r.share}%`, background: C[r.id] }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">{COLOUR_ROLES.map(r => <li key={r.id} className="ed-data">{r.name} <span className="ed-muted">about {r.share}%</span></li>)}</ul>
    </Screen>
    <Screen id="c-roles" label="Roles" title="One job each">
      <table className="brand-roles w-full border-collapse" data-roles="">
        <thead><tr className="ed-kicker text-left"><th scope="col" className="pb-2 pr-4">Colour</th><th scope="col" className="pb-2 pr-4">Hex</th><th scope="col" className="pb-2 pr-4">The job</th><th scope="col" className="pb-2">The limit</th></tr></thead>
        <tbody>{[...COLOUR_ROLES.map(r => ({ id: r.id as string, name: r.name as string, limit: r.limit as string })), ...SUPPORTING.map(id => ({ id: id as string, name: id === "newsprint" ? "Newsprint" : "Muted", limit: "Supporting: never a lead." }))].map(r => <tr key={r.id} className="border-t-[1.5px] border-ed-ink align-top" data-role={r.id}>
          <th scope="row" className="py-3 pr-4 text-left"><span className="flex items-center gap-3"><span className="inline-block h-8 w-8 shrink-0 border-[1.5px] border-ed-ink" style={{ background: C[r.id as keyof typeof C] }} aria-hidden="true" /><span className="ed-h4">{r.name}</span></span></th>
          <td className="py-3 pr-4"><Code>{C[r.id as keyof typeof C]}</Code></td><td className="ed-small py-3 pr-4">{roles[r.id]}</td><td className="ed-small py-3">{r.limit}</td>
        </tr>)}</tbody>
      </table>
    </Screen>
    <Screen id="c-contrast" label="Contrast" title="Measured from the tokens, live">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">{CONTRAST_AGAINST_INK.map(id => { const r = contrast(C.ink, C[id]); return <li key={id} className="border-[3px] border-ed-ink p-4" style={{ background: C[id], color: C.ink }} data-contrast={id}>
        <p className="ed-kicker">Ink on {id}</p><p className="ed-figure-num mt-2">{ratioText(C.ink, C[id])}</p><p className="ed-caption mt-1" style={{ color: C.ink }}>{r >= AA.text ? "Passes for text (4.5)" : r >= AA.large ? "Large type only (3)" : "Fails"}</p>
      </li>; })}
        <li className="border-[3px] border-ed-ink p-4" style={{ background: C.paper, color: C.red }} data-contrast="red-on-paper"><p className="ed-kicker" style={{ color: C.ink }}>Red on paper</p><p className="ed-figure-num mt-2">{ratioText(C.red, C.paper)}</p><p className="ed-caption mt-1" style={{ color: C.ink }}>{COLOUR_NOTES.red}</p></li>
      </ul>
      <p className="ed-caption mt-4">WCAG ratios, computed on this page from the token hexes. The guidelines quote red on ink as 4.6, red on paper as 3.6 and red on pink as 2.0; computed here from the hexes they are {ratioText(C.red, C.ink)}, {ratioText(C.red, C.paper)} and {ratioText(C.red, C.pink)}, so red stays large or a mark.</p>
    </Screen>
    <Screen id="c-stage" label="Stages" title="Five stages, five fills">
      <ul className="flex flex-wrap gap-3">{STAGES.map(s => <li key={s}><StageWord stage={s} /></li>)}</ul>
      <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-5">{STAGES.map(s => { const k = s.toLowerCase() as keyof typeof K.stage; return <li key={s} className="border-[3px] border-ed-ink p-3" style={{ background: K.stage[k].bg, color: K.stage[k].fg }} data-stage-swatch={k}><p className="ed-kicker">{s}</p><p className="ed-code mt-2">{K.stage[k].bg}</p></li>; })}</ul>
      <p className="ed-body mt-4">{COLOUR_NOTES.stages}</p>
    </Screen>
    <Screen id="c-modes" label="Three modes" title="The same sample in light, dark and vibes">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{(["light", "dark", "vibes"] as Mode[]).map(m => <ModeSample key={m} mode={m} />)}</div>
    </Screen>
  </BrandShell>;
}
function ModeSample({ mode }: { mode: Mode }) {
  return <figure data-mode={mode} className="digest border-[3px] border-[var(--tk-rule-strong)] p-4" style={{ minHeight: 0, background: "var(--tk-surface-page)", color: "var(--tk-text-primary)" }} data-mode-sample={mode}>
    <figcaption className="ed-kicker">{mode}</figcaption>
    <p className="ed-caption mt-1">{COLOUR_NOTES.modes[mode]}</p>
    <div className="mt-4"><Wordmark height={28} ground="auto" /></div>
    <Plate className="mt-4"><p className="ed-kicker">No. 45 · Today</p><p className="ed-h4 mt-2">Almost no dev tools brand uses lifestyle photography</p></Plate>
    <Card className="mt-4"><p className="ed-small">A card you read from.</p><p className="mt-2 flex flex-wrap gap-2"><span className="ed-badge" data-stage="rising">Rising</span><BasisWord b="measured" /><BasisWord b="ai" /></p></Card>
    <div className="mt-4"><Raised>Receipts →</Raised></div>
  </figure>;
}

// ——— /brand/type ———————————————————————————————————————————————————————————————————————————————————
const SPEC: Record<string, string> = { display: "Aa", text: "Aa", mono: "0123 #FF8FC4" };
export function BrandType() {
  const { data } = useSuspenseQuery(kitQuery());
  const [a, b, c] = [data.stories[0], data.stories[1] ?? data.stories[0], data.stories[2] ?? data.stories[0]];
  const sig = data.signals[0];
  const copy: Record<(typeof TYPE_LADDER)[number], string> = {
    display: sig?.name ?? "Big type", h1: a?.headline ?? "", h2: b?.headline ?? "", h3: c?.headline ?? "", kicker: a?.kicker ?? "Today", chip: "Measured",
    deck: a?.deck ?? b?.deck ?? "", body: b?.deck ?? a?.deck ?? "", quote: c?.deck ?? a?.deck ?? "", figure: sig?.share != null ? `${(sig.share * 100).toFixed(1)}%` : "27.6%",
    caption: a ? `Story captured ${a.at.slice(0, 10)}, with its receipts.` : "Captured with receipts.", data: sig ? `${sig.key} · ${C.pink}` : "combo:big_type · #FF8FC4",
  };
  return <BrandShell page="type">
    <Screen id="t-faces" label="Faces" title="Two families and one utility face">
      <ul className="space-y-8">{TYPE_FACES.map(f => <li key={f.id} className="ed-hair pt-4"><p style={{ fontFamily: `var(--tk-font-${f.id})`, fontWeight: f.id === "display" ? 900 : 400, fontSize: 96, lineHeight: 1 }} aria-hidden="true">{SPEC[f.id]}</p><h3 className="ed-h3 mt-3">{f.name}</h3><p className="ed-body mt-2">{f.use}</p></li>)}</ul>
    </Screen>
    <Screen id="t-ladder" label="The ladder" title="Every role, set with real story copy">
      <ul className="space-y-10">{TYPE_LADDER.map(r => { const t = LIGHT.type[r]; const kit = (K.type as Record<string, { size: number; leading: number; tracking?: string | number }>)[r]!;
        return <li key={r} className="ed-hair min-w-0 pt-4" data-role={r}>
          <p className={`tk-t-${r} break-words`}>{copy[r] || r}</p>
          <p className="ed-caption mt-3"><span className="ed-kicker mr-2">{r}</span>{t.family === "display" ? "Big Shoulders" : t.family === "text" ? "Newsreader" : "IBM Plex Mono"} {t.weight}{t.style === "italic" ? " italic" : ""} · <span data-size="">{kit.size}</span> / <span data-leading="">{kit.leading}</span>{kit.tracking ? <> · tracking <span data-tracking="">{String(kit.tracking)}</span></> : null}{t.sizeXl || t.sizeMd ? ` · steps ${t.size}${t.sizeMd ? ` → ${t.sizeMd}` : ""}${t.sizeXl ? ` → ${t.sizeXl}` : ""} on smaller screens` : ""}</p>
        </li>; })}</ul>
    </Screen>
    <Screen id="t-rules" label="Rules" title="Four type rules"><Rules rules={TYPE_RULES} /></Screen>
  </BrandShell>;
}

// ——— /brand/containers ———————————————————————————————————————————————————————————————————————————————
export function ContainerDemo({ name }: { name: (typeof CONTAINER_NAMES)[number] }) {
  const body = <p className="ed-small">{CONTAINER_RULES[name].name}</p>;
  switch (name) {
    case "sheet": return <Sheet className="border-[1.5px] border-dashed border-ed-ink p-4">{body}</Sheet>;
    case "rulebox": return <RuleBox>{body}</RuleBox>;
    case "card": return <Card>{body}</Card>;
    case "slab": return <Slab className="p-4"><p className="ed-navtext">Live · Signals · Brands</p></Slab>;
    case "plate": return <Plate><p className="ed-h4">The one loud thing</p></Plate>;
    case "raised": return <div className="pb-2"><Raised>Press me</Raised></div>;
    case "sticker": return <div className="py-2"><Sticker>3 new stories</Sticker></div>;
    case "photo": return <PhotoPlate media={<div className="brand-photo c-photo-media h-28" role="img" aria-label="A stand-in for a photograph" />}>Caption on the ink strip</PhotoPlate>;
  }
}
export function BrandContainers() {
  return <BrandShell page="containers">
    <Screen id="k-eight" label="The eight" title="Each with its rules built in">
      <ul className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">{CONTAINER_NAMES.map(n => <li key={n} data-container-demo={n}>
        <ContainerDemo name={n} />
        <h3 className="ed-h4 mt-4">{CONTAINER_RULES[n].name}</h3>
        <dl className="mt-2 space-y-1"><div className="flex gap-2"><dt className="ed-kicker w-16 shrink-0">Use for</dt><dd className="ed-small">{CONTAINER_RULES[n].use}</dd></div><div className="flex gap-2"><dt className="ed-kicker w-16 shrink-0">Never</dt><dd className="ed-small">{CONTAINER_RULES[n].never}</dd></div></dl>
      </li>)}</ul>
    </Screen>
    <Screen id="k-map" label="The front page" title="Its container map">
      <div className="space-y-2 border-[1.5px] border-ed-ink p-2" data-container-map="" aria-label="The front page's containers, top to bottom">
        {[["slab", "Slab: the chrome (the mark on its pink slab, six sections, the live dot, Read / Terminal)"], ["slab", "Slab: the ticker"], ["sheet", "Sheet: the date and the state, pinned left and right"], ["plate", "Plate: the lead (the one per screen), with a Raised “Receipts” button"], ["rulebox", "Rule box: Moving now"]].map(([k, t], i) => <MapBox key={i} kind={k as never} text={t!} />)}
        <div className="grid grid-cols-3 gap-2"><div className="col-span-2 space-y-2"><MapBox kind="sheet" text="Ledger: the live column, under its time headings; new stories wait behind a Sticker" tall /></div><div className="space-y-2"><MapBox kind="card" text="Card: chart of the day" /><MapBox kind="rulebox" text="Rule box: your sector" /></div></div>
        {[["rulebox", "Rule box: editions"], ["rulebox", "Rule box: studies"], ["slab", "Slab: the footer"]].map(([k, t], i) => <MapBox key={`b${i}`} kind={k as never} text={t!} />)}
      </div>
    </Screen>
    <Screen id="k-rules" label="Rules" title="Five container rules"><Rules rules={CONTAINER_LAWS} /></Screen>
  </BrandShell>;
}
function MapBox({ kind, text, tall }: { kind: "slab" | "sheet" | "plate" | "rulebox" | "card"; text: string; tall?: boolean }) {
  const cls = { slab: "c-slab p-2", sheet: "border-[1.5px] border-dashed border-ed-ink p-2", plate: "c-plate !p-2", rulebox: "c-rulebox !p-2", card: "c-card !p-2" }[kind];
  return <div className={`${cls} ${tall ? "min-h-40" : ""}`} data-map={kind}><p className="ed-caption" style={{ color: "inherit" }}>{text}</p></div>;
}

// ——— /brand/space ——————————————————————————————————————————————————————————————————————————————————
export function BrandSpace() {
  const sp = activeTheme.shared.space, d = activeTheme.shared.density;
  return <BrandShell page="space">
    <Screen id="s-scale" label="The scale" title="Seven steps">
      <ul className="space-y-3" data-scale="">{(Object.entries(sp) as [string, string][]).map(([k, v]) => <li key={k} className="flex items-center gap-4"><span className="ed-stat w-24 shrink-0">{v.replace("px", "")}</span><span className="tk-space-bar" style={{ width: v }} aria-hidden="true" /></li>)}</ul>
    </Screen>
    <Screen id="s-density" label="Densities" title="Quiet, Steady and Loud">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{(["quiet", "steady", "loud"] as const).map(k => <figure key={k} data-density-demo={k}>
        <div className="border-[3px] border-ed-ink bg-[var(--tk-surface-card)] p-3" aria-hidden="true">
          <div style={{ height: k === "quiet" ? 52 : k === "steady" ? 16 : 4 }} />
          <div className={k === "quiet" ? "grid grid-cols-3 gap-2" : ""}>{k === "quiet" && <div className="h-3 w-full bg-[var(--tk-rule-strong)] opacity-40" />}
            <div className={k === "quiet" ? "col-span-2" : ""} style={{ display: "grid", gap: parseInt(d[k].inner) / 2 }}>
              {k === "steady" && <div className="h-16 border-[1.5px] border-ed-ink bg-[var(--tk-plate-bg)]" />}
              {Array.from({ length: k === "loud" ? 6 : 3 }, (_, i) => <div key={i} className={k === "loud" ? "grid grid-cols-3" : ""} style={{ gap: parseInt(d[k].block) / 2 }}>{(k === "loud" ? [0, 1, 2] : [0]).map(j => <div key={j} className="h-6 bg-[var(--tk-surface-sunken)]" />)}</div>)}
            </div></div>
        </div>
        <figcaption className="mt-3"><p className="ed-h4">{k}</p><p className="ed-small mt-1">{DENSITY_NOTES[k].empty}. {DENSITY_NOTES[k].use}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2"><Fact k="Blocks" v={d[k].block.replace("px", "")} /><Fact k="Inside" v={d[k].inner.replace("px", "")} /><Fact k="Air" v={d[k].air.replace("px", "")} /></dl></figcaption>
      </figure>)}</div>
      <p className="ed-caption mt-4">Skeletons are drawn at half scale. Each route's density is recorded in the site map, and the page shell applies it.</p>
    </Screen>
    <Screen id="s-rules" label="Rules" title="Four space rules"><Rules rules={SPACE_RULES} /></Screen>
  </BrandShell>;
}

// ——— /brand/illustration ———————————————————————————————————————————————————————————————————————————
const ILLUSTRATION_USE: Record<string, string> = {
  cut: "Used on story covers. The picture is a crop printed in one ink, or the stored layout redrawn; the pencil note is a real fact.",
  trail: "Used on the lead plate, signal covers and data-story covers. It takes the chart's own series and keeps the table.",
  soft: "Used on Digest, Morning Line and sector report covers: the issue number or the day's figure.",
};
/** Demo data: the shape of real stored values (a share series and a story), labelled as a sample. */
const DEMO_SERIES = [{ x: "Q1 2024", y: 0.212 }, { x: "Q3 2024", y: 0.268 }, { x: "Q1 2025", y: 0.241 }, { x: "Q3 2025", y: 0.336 }, { x: "Q1 2026", y: 0.47 }];
/** A sample after-frame redrawn from fixture skeleton boxes (the same path story covers use), so the demo shows a real redraw. */
const DEMO_FRAME = storyFrames("sample.com", [fxCapture(1, "2026-10-01T00:00:00Z"), fxCapture(2, "2026-11-16T00:00:00Z", { bg: "#0A0A0A", source: "live" })], "2026-11-15T00:00:00Z")?.after ?? null;
function IllustrationDemo({ id }: { id: string }) {
  if (id === "trail") return <Trail points={DEMO_SERIES} label="Sample: a signal's share of homepages by quarter" format={v => `${(v * 100).toFixed(1)}%`} w={720} h={400} seed="brand-trail" />;
  if (id === "soft") return <SoftObject text="47" seed="brand-soft" ink="pink" print="yellow" label="Sample: the number 47 as a soft object" />;
  return <div className="cover c-slab p-6" data-cover="sample">
    <CutAndPaste seed={48} note="Confirmed 16 Nov" picture={DEMO_FRAME ? <CaptureFrame fr={DEMO_FRAME} label={FRAME_LABEL} /> : <div className="brand-demo-frame"><span className="ed-kicker">{FRAME_LABEL}</span></div>} />
    <p className="cover-head mt-4"><HeadlineStrips text="neon.com changed its hero" seed={48} /></p>
  </div>;
}
export function BrandIllustration() {
  return <BrandShell page="illustration"><FiltersScope>
    <Screen id="i-rules" label="Rules" title="Three materials, one light"><Rules rules={ILLUSTRATION_RULES} /></Screen>
    {ILLUSTRATION_STYLES.map((st, i) => <Screen key={st.id} id={`i-${st.id}`} label={`Style ${String(i + 1).padStart(2, "0")}`} title={st.name} tall>
      <div data-style={st.id}>
        <p className="ed-body">{st.what}</p>
        <p className="mt-3 flex flex-wrap gap-2">{st.filters.map(f => <Code key={f}>{f}</Code>)}</p>
        <p className="ed-caption mt-2">{ILLUSTRATION_USE[st.id]}</p>
        <div className="mt-6"><Replay name={st.name}>{() => <IllustrationDemo id={st.id} />}</Replay></div>
      </div>
    </Screen>)}
  </FiltersScope></BrandShell>;
}

// ——— /brand/motion —————————————————————————————————————————————————————————————————————————————————
function GrowBar() {
  const [ref, cls] = useGrow<HTMLSpanElement>();
  return <span ref={ref} className={`brand-demo-bar ${cls}`.trim()} aria-hidden="true" />;
}
/** Press: on replay the Raised control travels into its shadow for one tap and comes back; the sticker pops as it mounts. */
function PressDemo({ played }: { played: boolean }) {
  const [down, setDown] = useState(false);
  useEffect(() => {
    if (!played || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const tap = MOTION_MS.tap; let t2 = 0;
    const t1 = window.setTimeout(() => { setDown(true); t2 = window.setTimeout(() => setDown(false), tap * 2); }, tap);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [played]);
  return <div className="flex flex-wrap items-center gap-6"><Raised data-pressed={down ? "" : undefined}>Press me</Raised><Sticker data-pop="">New</Sticker></div>;
}
function MotionDemo({ id, played }: { id: string; played: boolean }) {
  const on = played ? "m-demo-on" : "";
  if (id === "arrive") return <span className={`brand-demo-mark ${on}`.trim()}><Wordmark height={120} letters decorative /></span>;
  if (id === "press") return <PressDemo played={played} />;
  if (id === "cut") return <div className={`brand-demo-wipe c-slab ${on}`.trim()}><p className="ed-h2">The next page</p></div>;
  if (id === "count") return <div><p className="ed-cover"><Count text="47.0%" /></p><GrowBar /></div>;
  return <FiltersScope><Trail points={DEMO_SERIES} label="Sample: the trail drawing along its path" format={v => `${(v * 100).toFixed(1)}%`} w={640} h={300} sticker={false} seed="brand-draw" /></FiltersScope>;
}
export function BrandMotion() {
  const m = activeTheme.shared.motion as unknown as Record<string, string>;
  const ease = { linear: "linear", ooze: m["ooze"]!, cut: m["cut"]!, settle: m["settle"]! } as Record<string, string>;
  return <BrandShell page="motion">
    <Screen id="mo-rules" label="Rules" title="One thing moves at a time"><Rules rules={MOTION_RULES} /></Screen>
    <Screen id="mo-tokens" label="Timings" title="Five timings, three easings">
      <dl className="grid grid-cols-2 gap-6 md:grid-cols-3">{(["tap", "move", "wipe", "arrive", "draw", "stagger"] as const).map(k => <Fact key={k} k={k} v={<span data-motion={k}>{m[k]}</span>} />)}</dl>
      <ul className="mt-8 space-y-2">{(["ooze", "cut", "settle"] as const).map(k => <li key={k} className="flex flex-wrap items-baseline gap-x-4"><span className="ed-h4 w-24">{k}</span><Code>{m[k]}</Code></li>)}</ul>
    </Screen>
    {MOTION_PATTERNS.map((p, i) => <Screen key={p.id} id={`mo-${p.id}`} label={`Pattern ${i + 1}`} title={p.name}>
      <div data-pattern={p.id}>
        <p className="ed-body">{p.for}</p>
        <p className="ed-caption mt-2">{p.token} · <Code>{m[p.token]}</Code> · {p.ease} <Code>{ease[p.ease]}</Code> · keyframes {p.keyframes.map(k => <Code key={k}>{k} </Code>)}</p>
        <div className="mt-6"><Replay name={p.name}>{played => <MotionDemo id={p.id} played={played} />}</Replay></div>
      </div>
    </Screen>)}
  </BrandShell>;
}

// ——— /brand/downloads ——————————————————————————————————————————————————————————————————————————————
const GROUP_NAME: Record<string, string> = { "logo/svg": "Logo, SVG", "logo/png": "Logo, PNG", tokens: "Tokens", motion: "Motion", illustration: "Illustration", guidelines: "Guidelines" };
export function BrandDownloads() {
  const { data } = useSuspenseQuery(kitFilesQuery());
  const groups = [...new Set(data.map(f => f.group))];
  return <BrandShell page="downloads">
    {groups.map(g => <Screen key={g} id={`d-${g.replace(/\W/g, "-")}`} label={GROUP_NAME[g] ?? g}>
      <Ledger rows={data.filter(f => f.group === g).map(f => ({ key: f.name, href: f.href, plain: true, title: <span className="ed-code">{f.name}</span>, line: f.what, facts: [sizeText(f.bytes)], tags: [f.type] }))} />
    </Screen>)}
    <Screen id="d-note" label="Where these live"><p className="ed-body">Every file comes from the kit folder and is served only to people past the password. The guidelines file is the source of truth for every rule on these pages.</p></Screen>
  </BrandShell>;
}
