import { line as voiced } from "@/lib/voice";
// /data/where-you-sit: the reader picks a tracked brand (search over the tracked list only — no free-text URLs, no crawling on demand)
// and gets its own short story from the same templates. A brand that is not tracked is pointed at the audit.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { StoryModel } from "@/lib/data-stories/types";
import { pickBrands } from "@/lib/data-stories/picker";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { StoryBody, StoryEnding, StoryHead } from "./DataStoryView";
import { WHERE_YOU_SIT, templateName } from "@/lib/data-stories/registry";

type Brand = { domain: string; name: string; sector: string };
export type SitResult = { kind: "story"; story: StoryModel } | { kind: "untracked"; domain: string } | { kind: "none" };
export function WhereYouSitView({ brands, result, step, onStep }: { brands: Brand[]; result: SitResult; step: number; onStep: (k: number) => void }) {
  const nav = useNavigate(), [q, setQ] = useState(""), [miss, setMiss] = useState<string | null>(null);
  const hits = useMemo(() => pickBrands(brands, q, 12), [brands, q]);
  const choose = (d: string) => { setMiss(null); void nav({ to: "/data/where-you-sit", search: { brand: d, step: 1 }, resetScroll: false }); };
  const head = { number: WHERE_YOU_SIT.number, question: result.kind === "story" ? result.story.question : WHERE_YOU_SIT.question, deck: WHERE_YOU_SIT.deck, template: templateName(WHERE_YOU_SIT), dataThrough: result.kind === "story" ? result.story.dataThrough : null };
  return <DigestShell label="Data stories" section="signals">
    <article className="pb-8">
      <StoryHead s={head} />
      <form className="ed-wrap no-print mt-6" role="search" onSubmit={e => { e.preventDefault(); const exact = pickBrands(brands, q, 1)[0]; if (exact && (exact.domain === q.trim().toLowerCase() || exact.name.toLowerCase() === q.trim().toLowerCase() || hits.length === 1)) choose(exact.domain); else setMiss(q.trim()); }}>
        <label htmlFor="sit-q" className="ed-kicker block">Pick one of the {brands.length} tracked brands</label>
        <input id="sit-q" className="tk-input tk-t-data mt-2 w-full max-w-[40ch]" value={q} onChange={e => { setQ(e.target.value); setMiss(null); }} placeholder="Search by name or domain" autoComplete="off" aria-describedby="sit-hint" />
        <p id="sit-hint" className="ed-small ed-muted mt-1">Only tracked brands; nothing is crawled on demand.</p>
        {q.trim() && <ul className="mt-2 grid max-w-[60ch] gap-1 sm:grid-cols-2" aria-label="Matching brands">{hits.map(b => <li key={b.domain}><button type="button" onClick={() => choose(b.domain)} className="tk-btn tk-t-kicker w-full justify-start text-left" data-variant="secondary">{b.name} <span className="tk-c-muted ml-2">{b.domain}</span></button></li>)}
          {!hits.length && <li className="ed-small">{voiced("data.whereYouSitView.1")} <Link to="/audit/new" className="ed-tap">Run an audit instead →</Link></li>}</ul>}
        {miss && <p className="ed-small mt-2" role="status">“{miss}” isn't one of the tracked brands. <Link to="/audit/new" className="ed-tap">Run an audit instead →</Link></p>}
      </form>
      {result.kind === "untracked" && <p className="ed-wrap ed-body mt-8" role="status">{result.domain} isn't tracked, so there is no stored history to draw from. <Link to="/audit/new" className="ed-tap">Audit it instead →</Link></p>}
      {result.kind === "story" && <><StoryBody s={result.story} step={step} onStep={onStep} /><StoryEnding s={result.story} /></>}
    </article>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
