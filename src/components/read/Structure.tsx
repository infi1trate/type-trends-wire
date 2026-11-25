// J1 + M1 · how a homepage is built, read from stored structure rows only: the brand page block, the Structure dimension on /signals,
// a structure signal's page, the navigation words page and the sector rows. Section roles are a rule-based guess; nothing is AI.
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandStructureQuery, navPatternsQuery, scopeStructureQuery, structureIndexQuery, structureSignalQuery } from "@/lib/data";
import { ASK_NAME, NAV_WORDS, NOT_READ, PHONE_NAV_NAME, ROLE_NAME, SIGNIN_WORDINGS, STRUCTURE_FLOOR, TOO_FEW, desktopPhone, navWordKey, pctText, quarterBack, quarterLabel, shareOf, signinKey, nearestRead, covered, type SeriesRow, type StructureRecord } from "@/lib/structure";
import { sectorName } from "@/lib/labels";
import { Bars, QuarterLine, Sparkline } from "@/components/chartkit";
import { INK, MUTED, PAGE, RULE } from "@/components/chartkit/ink";

const sig = (key: string) => `/signals/${encodeURIComponent(key)}`;
const SigLink = ({ k, children }: { k: string; children: React.ReactNode }) => <Link to={sig(k) as string} className="ed-tap">{children}</Link>;
const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)} pts`);

/** (a) the page as a vertical strip of its sections, each band's height proportional to its section. Hero in the brand's stored accent. */
export function PageStrip({ r, label }: { r: StructureRecord; label: string }) {
  const secs = (r.sections ?? []).filter(s => s.h > 0), total = Math.max(1, r.page_h ?? 0, ...secs.map(s => s.y + s.h));
  const H = 360, BW = 56;
  return <figure className="min-w-0" data-structure-strip={label}>
    <figcaption className="ed-kicker">{label}{r.screens != null ? ` · ${r.screens.toFixed(1)} screens` : ""}</figcaption>
    <svg viewBox={`0 0 220 ${H}`} className="mt-2 block h-[360px] w-full max-w-[220px]" role="img" aria-label={`${label}: ${secs.map(s => ROLE_NAME[s.r] ?? s.r).join(", ") || "no sections read"}`}>
      <rect x={0} y={0} width={BW} height={H} fill={PAGE} stroke={RULE} />
      {(() => { let last = -Infinity; return secs.map((s, i) => { const y = (s.y / total) * H, h = Math.max(1, (s.h / total) * H), hero = s.r === "hero", ty = y + Math.min(h / 2 + 4, Math.max(10, h - 2));
        // A label shows only when its band is tall enough and it clears the label above, so names never overlap.
        const show = h >= 11 && ty - last >= 13; if (show) last = ty;
        return <g key={i} aria-hidden="true">
          <rect x={0} y={y} width={BW} height={h} fill={hero && r.accent ? r.accent : PAGE} stroke={INK} strokeWidth={1} />
          {show && <text x={BW + 8} y={ty} className="tk-svg-text" style={{ fill: hero ? INK : MUTED }}>{ROLE_NAME[s.r] ?? s.r}</text>}
        </g>; }); })()}
    </svg>
  </figure>;
}

const Line = ({ k, label, children }: { k: string | null; label: string; children: React.ReactNode }) => <div className="ed-hair grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-baseline gap-3 py-2">
  <dt className="ed-kicker">{k ? <SigLink k={k}>{label}</SigLink> : label}</dt><dd className="ed-small min-w-0 break-words">{children}</dd>
</div>;

/** The brand page block "How the page is built". */
export function StructurePart({ domain }: { domain: string }) {
  const { data } = useSuspenseQuery(brandStructureQuery(domain));
  const d = data.desktop?.record ?? null, p = data.phone?.record ?? null;
  if (!d && !p) return <p className="ed-small" data-structure-none="">{NOT_READ}</p>;
  const main = d ?? p!, f = main.furniture ?? {}, asks = [...(main.asks ?? [])].sort((a, b) => Number(b.p) - Number(a.p));
  const m = p?.mobile ?? null, yes = (v: unknown) => !!v;
  return <div data-structure-block="">
    <div className="flex flex-wrap gap-8">{d && <PageStrip r={d} label="Desktop" />}{p && <PageStrip r={p} label="Phone" />}</div>
    <div className="ed-grid mt-8">
      <div className="lg:col-span-6">
        <h4 className="ed-kicker">It asks you to</h4>
        {asks.length ? <ul className="mt-2 flex flex-wrap gap-2" data-structure-asks="">{asks.map((a, i) => <li key={i}><Link to={sig(a.k === "demo" || a.k === "sales" ? "ask:demo" : "ask:start") as string} className="ledger-tag cat-chip no-underline" title={ASK_NAME[a.k] ?? a.k}>{a.l}{i === 0 && a.p ? <span className="ledger-muted"> · primary</span> : null}</Link></li>)}</ul>
          : <p className="ed-small mt-2">No call to action on the first screen.</p>}
        <h4 className="ed-kicker mt-6">Furniture</h4>
        <dl className="mt-2">
          <Line k="furn:search" label="Search">{yes(f["search"]) ? "Yes" : "No"}{yes(f["cmdk"]) ? ", with a ⌘K menu" : ""}</Line>
          <Line k="furn:chat" label="Chat">{typeof f["chat"] === "string" ? `Yes (${f["chat"]})` : yes(f["chat"]) ? "Yes" : "No"}</Line>
          <Line k="furn:ask_ai" label="Ask-AI box">{typeof f["ask_ai"] === "string" ? `“${f["ask_ai"]}”` : yes(f["prompt_box"]) ? "A prompt box" : "No"}</Line>
          <Line k="furn:lang_switch" label="Language switch">{yes(f["lang_switch"]) ? "Yes" : "No"}</Line>
          <Line k="nav:signin_wording_login" label="Sign-in wording">{main.signin ? `“${main.signin.replace(/^./, c => c.toUpperCase())}”` : "No sign-in item"}</Line>
          <Line k="furn:announcement_bar" label="Announcement bar">{typeof f["bar"] === "string" ? `“${f["bar"]}”` : "None"}</Line>
        </dl>
      </div>
      <div className="lg:col-span-6">
        <h4 className="ed-kicker">On a phone</h4>
        {m ? <dl className="mt-2">
          <Line k={m.nav === "bar" || m.nav === "drawer+bar" ? "phone:bottom_bar" : "phone:drawer"} label="Navigation">{m.nav ? PHONE_NAV_NAME[m.nav] ?? m.nav : "Not read"}</Line>
          <Line k="phone:sticky_ask" label="Ask that stays">{m.sticky ? `“${m.sticky}”` : "None"}</Line>
          <Line k="phone:app_push" label="App push">{m.smart_banner || m.app_prompt || (m.store_first ?? 0) >= 1 ? "Sends you to the app first" : "No"}</Line>
          <Line k="phone:small_taps" label="Small tap targets">{m.tap_small == null ? "Not read" : `${Math.round(m.tap_small)}% under 44 px`}</Line>
          <Line k="phone:small_text" label="Body text">{m.body_px == null ? "Not read" : `${m.body_px} px`}</Line>
        </dl> : <p className="ed-small mt-2">{NOT_READ}</p>}
      </div>
    </div>
    <p className="ed-caption mt-4">Read from the stored homepage capture{data.quarter ? ` in ${quarterLabel(data.quarter)}` : ""}. Section names are given by rule from what each section holds.</p>
  </div>;
}

/** /signals?tab=structure: the structure signals as ledger rows (desktop and phone shares past the floor, four-quarter change). */
export function StructureIndex({ scope }: { scope: string }) {
  const { data } = useSuspenseQuery(structureIndexQuery(scope));
  const rows = [...data.rows].sort((a, b) => (b.desktop ?? b.phone ?? -1) - (a.desktop ?? a.phone ?? -1));
  const digits = String(rows.length).length;
  return <section className="ed-wrap mt-12" aria-labelledby="sig-structure" data-structure-index="">
    <h2 id="sig-structure" className="ed-h3 inline">Structure · {rows.length}</h2>
    <p className="ed-caption mt-1">How the homepages slug reads are built and how they behave on a phone, measured from the page{data.quarter ? `, ${quarterLabel(data.quarter)}` : ""}. A share needs {STRUCTURE_FLOOR} brands read; section names are given by rule.{scope !== "all" ? ` ${sectorName(scope)} only.` : ""}</p>
    <div className="mt-3" data-signal-rows="">
      <div className="sig-head ed-kicker" aria-hidden="true"><span className="sig-rank" style={{ minWidth: `${digits}ch` }} /><span /><span className="sig-spark-col" /><span className="sig-fig">Desktop</span><span className="sig-fig">Phone</span><span className="sig-fig">Change</span></div>
      <ul className="ledger" aria-label="Structure signals" data-ledger="" data-ledger-digits={digits}>
        {rows.map((r, i) => <li key={r.key} className="ledger-row" data-ledger-row="">
          <Link to={sig(r.key) as string} className="ledger-link sig-link">
            <span className="ledger-num sig-rank"><span className="ledger-fit"><span>{i + 1}</span><span aria-hidden="true" className="ledger-ghost">{"0".repeat(digits)}</span></span></span>
            <span className="ledger-title sig-name">{r.name}<span className="ledger-line">{r.source === "history" ? "Measured · history from 2020" : `Measured · from ${r.since ? quarterLabel(r.since) : "the next pass"}`}</span></span>
            <span className="sig-spark-col sig-spark"><Sparkline look="read" w={240} h={32} stretch values={r.points} label={`${r.name}, quarters with ${STRUCTURE_FLOOR}+ brands read`} /></span>
            <span className="sig-fig tabular-nums"><span className="sig-fig-label ed-kicker md:sr-only">Desktop </span>{r.desktop == null ? (r.nDesktop ? "too few" : "—") : pctText(r.desktop)}</span>
            <span className="sig-fig tabular-nums"><span className="sig-fig-label ed-kicker md:sr-only">Phone </span>{r.phone == null ? (r.nPhone ? "too few" : "—") : pctText(r.phone)}</span>
            <span className="sig-fig tabular-nums"><span className="sig-fig-label ed-kicker md:sr-only">Change </span>{signed(r.change)}</span>
          </Link>
        </li>)}
      </ul>
    </div>
  </section>;
}

/** Desktop against phone as two bars, each only past the floor. */
export function DesktopPhone({ name, d, p }: { name: string; d: { n_read: number; n_yes: number } | null; p: { n_read: number; n_yes: number } | null }) {
  const v = desktopPhone(d, p);
  if (!v.line) return null;
  const bars = [...(v.desktop != null ? [{ id: "desktop", label: "Desktop", value: v.desktop }] : []), ...(v.phone != null ? [{ id: "phone", label: "Phone", value: v.phone }] : [])];
  return <div data-desktop-phone="">
    <p className="ed-data tabular-nums">{v.line}</p>
    {bars.length === 2 && <div className="mt-3 max-w-[640px]"><Bars look="read" bars={bars} format={x => pctText(x)} valueLabel="Share" title={`${name}: desktop against phone`} note={`Of the brands read on each, ${d?.n_read ?? 0} on desktop and ${p?.n_read ?? 0} on a phone.`} source="Stored homepage captures" /></div>}
  </div>;
}

/** A structure signal's page body. */
export function StructureSignalView({ k }: { k: string }) {
  const { data } = useSuspenseQuery(structureSignalQuery(k));
  if (!data) return null;
  const vp = data.viewports.includes("desktop") ? "desktop" : "phone";
  const pts = data.trail.filter(t => (vp === "desktop" ? t.desktop : t.phone) != null).map(t => ({ x: t.quarter, y: (vp === "desktop" ? t.desktop : t.phone)! }));
  return <div className="ed-wrap mt-10 space-y-12" data-structure-signal={k}>
    <section aria-labelledby="ss-now">
      <h2 id="ss-now" className="ed-h3">Now</h2>
      <div className="mt-3">{desktopPhone(data.desktop, data.phone).line ? <DesktopPhone name={data.name} d={data.desktop} p={data.phone} /> : <p className="ed-small">{TOO_FEW}</p>}</div>
    </section>
    <section aria-labelledby="ss-trail">
      <h2 id="ss-trail" className="ed-h3">By quarter</h2>
      {pts.length >= 2 ? <div className="mt-3"><QuarterLine look="read" series={[{ id: k, label: vp === "desktop" ? "Desktop" : "Phone", points: pts }]} y={{ label: "Share of brands read", format: x => pctText(x) }} title={`${data.name}, ${vp === "desktop" ? "desktop" : "phone"}`} note={`Quarters with ${STRUCTURE_FLOOR} or more brands read and at least a quarter of the most ever read; archived copies come about twice a year.`} source="Stored homepage captures and archive history" /></div>
        : <p className="ed-small mt-3">{data.source === "history" ? TOO_FEW : `This reading started ${pts[0] ? `in ${quarterLabel(pts[0].x)}` : "with the newest captures"}; a line needs two quarters.`}</p>}
    </section>
    <section aria-labelledby="ss-sectors">
      <h2 id="ss-sectors" className="ed-h3">By sector</h2>
      <ul className="mt-3 ed-data">{data.sectors.map(s => <li key={s.sector} className="ed-hair flex justify-between gap-4 py-2"><Link to="/sectors/$sector" params={{ sector: s.sector }} className="ed-tap">{sectorName(s.sector)}</Link><span className="tabular-nums">{s.share == null ? `too few (${s.n} read)` : pctText(s.share)}</span></li>)}</ul>
    </section>
    <section aria-labelledby="ss-brands">
      <h2 id="ss-brands" className="ed-h3">Brands with it · {data.brands.length}</h2>
      {data.brands.length ? <ul className="mt-3">{data.brands.map(b => <li key={b.domain} className="ed-hair flex min-w-0 items-start gap-3 py-2">
        <span className="min-w-0"><Link to="/brands/$domain" params={{ domain: b.domain }} className="ed-tap ed-small font-medium">{b.name}</Link>
          {b.words && <span className="ed-caption block break-words">{b.words.join(" · ")}</span>}</span>
      </li>)}</ul> : <p className="ed-small mt-3">No brand read has it yet.</p>}
      <p className="ed-caption mt-3">{data.meaning} Measured from the page{data.group === "page" ? "; section names are given by rule" : ""}.</p>
    </section>
  </div>;
}

/** /patterns/navigation: the 22 words, share now and five years ago, and the sign-in split. */
export function NavPatternsView({ look = "read" }: { look?: "read" | "data" }) {
  const { data } = useSuspenseQuery(navPatternsQuery());
  const q = data.quarter, back = q ? quarterBack(q, 20) : null;
  const at = (rows: SeriesRow[], key: string, qq: string | null) => (qq ? rows.find(r => r.signal === key && r.quarter === qq) ?? null : null);
  const thenQ = back ? nearestRead(data.words, navWordKey("pricing"), "desktop", back)?.quarter ?? null : null;
  const words = NAV_WORDS.map(w => { const k = navWordKey(w), now = shareOf(at(data.words, k, q)), then = shareOf(at(data.words, k, thenQ));
    const trail = covered(data.words.filter(r => r.signal === k)).sort((a, b) => a.quarter.localeCompare(b.quarter)).map(r => r.n_yes / r.n_read);
    return { w, now, then, change: now != null && then != null ? now - then : null, trail }; }).sort((a, b) => (b.now ?? -1) - (a.now ?? -1));
  const okQ = new Set(covered(data.signin.filter(r => r.signal === signinKey("log in"))).map(r => r.quarter));
  const qs = [...new Set(data.signin.map(r => r.quarter))].sort().filter(qq => okQ.has(qq));
  const split = qs.map(qq => ({ q: qq, parts: SIGNIN_WORDINGS.map(w => ({ w, s: shareOf(at(data.signin, signinKey(w), qq)) ?? 0 })) }));
  const word = (w: string) => w === "ai" ? "AI" : w.replace(/^./, c => c.toUpperCase());
  return <div className="space-y-12" data-nav-patterns={look}>
    <section aria-labelledby="nav-words">
      <h2 id="nav-words" className={look === "read" ? "ed-h3" : "tk-t-label"}>Words that lead the top navigation</h2>
      <p className={look === "read" ? "ed-caption mt-1" : "tk-t-caption tk-c-muted mt-1"}>Share of the homepages slug reads whose top navigation has an item starting with the word, desktop{q ? `, ${quarterLabel(q)}` : ""} against {thenQ ? quarterLabel(thenQ) : "five years ago (too few read)"}; archived copies come about twice a year, so “five years ago” is the nearest quarter with enough brands read. A share needs {STRUCTURE_FLOOR} brands read.</p>
      <div className="mt-3 overflow-x-auto"><table className={look === "read" ? "ed-data w-full tabular-nums" : "tk-t-data w-full tabular-nums"} data-nav-words="">
        <thead><tr className="ed-kicker text-left"><th className="py-2 pr-3">Word</th><th className="py-2 pr-3 text-right">Now</th><th className="py-2 pr-3 text-right">Five years ago</th><th className="py-2 pr-3 text-right">Change</th><th className="hidden py-2 md:table-cell">By quarter</th></tr></thead>
        <tbody>{words.map(r => <tr key={r.w} className="ed-hair"><td className="py-2 pr-3">{word(r.w)}</td><td className="py-2 pr-3 text-right">{pctText(r.now)}</td><td className="py-2 pr-3 text-right">{pctText(r.then)}</td><td className="py-2 pr-3 text-right">{signed(r.change)}</td>
          <td className="hidden py-2 md:table-cell"><Sparkline look="read" w={160} h={24} values={r.trail} label={`“${word(r.w)}” in navigation, by quarter`} /></td></tr>)}</tbody>
      </table></div>
    </section>
    <section aria-labelledby="nav-signin">
      <h2 id="nav-signin" className={look === "read" ? "ed-h3" : "tk-t-label"}>How the sign-in item is worded</h2>
      <p className={look === "read" ? "ed-caption mt-1" : "tk-t-caption tk-c-muted mt-1"}>Of the brands with a sign-in item in the top navigation, by quarter.</p>
      <ul className="mt-3 space-y-1" data-signin-split="">{split.map(s => <li key={s.q} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
        <span className="ed-data tabular-nums">{quarterLabel(s.q)}</span>
        <span className="flex h-5 min-w-0 overflow-hidden border" style={{ borderColor: RULE }} role="img" aria-label={s.parts.map(p => `${p.w} ${pctText(p.s)}`).join(", ")}>
          {s.parts.map((p, i) => <span key={p.w} style={{ width: `${p.s * 100}%`, background: i % 2 ? PAGE : INK }} />)}
        </span>
      </li>)}</ul>
      <p className="ed-caption mt-2">{SIGNIN_WORDINGS.map((w, i) => `${i % 2 ? "Light" : "Dark"}: “${w}”`).join(" · ")}. Latest: {split.at(-1)?.parts.map(p => `“${p.w}” ${pctText(p.s)}`).join(", ") ?? "too few read"}.</p>
    </section>
  </div>;
}

/** Sector page: a Structure group of the signals that pass the floor in the sector. */
export function ScopeStructure({ scope }: { scope: string }) {
  const { data } = useSuspenseQuery(scopeStructureQuery(scope));
  return <section className="ed-wrap mt-12" aria-labelledby="sector-structure" data-sector-structure="">
    <h2 id="sector-structure" className="ed-h3">Structure</h2>
    <p className="ed-caption mt-1">How {sectorName(scope)} homepages are built, desktop and phone. Only signals with {STRUCTURE_FLOOR} or more brands read here.</p>
    {data.length ? <ul className="mt-3 grid gap-x-8 md:grid-cols-2">{data.map(r => <li key={r.key} className="ed-hair flex justify-between gap-4 py-2 ed-data">
      <SigLink k={r.key}>{r.name}</SigLink><span className="tabular-nums whitespace-nowrap">{r.desktop != null ? `Desktop ${pctText(r.desktop)}` : ""}{r.desktop != null && r.phone != null ? " · " : ""}{r.phone != null ? `Phone ${pctText(r.phone)}` : ""}</span>
    </li>)}</ul> : <p className="ed-small mt-3">{TOO_FEW}</p>}
  </section>;
}
