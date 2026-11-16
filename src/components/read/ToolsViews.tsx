// /tools (every ACT tool, one line each) and /status (health, model card and ops details, out of the reader's path).
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cropCoverageQuery, healthQuery, modelCardQuery, runComparisonQuery } from "@/lib/data";
import { cropCoverageLine } from "@/lib/crops";
import { realRunLine } from "@/lib/run-gap";
import { coverageSentences } from "@/lib/model-card-copy";
import { storyTime } from "@/lib/stories";
import { SITE_URL } from "@/lib/site";
import { DigestShell, pr } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ReadFooter } from "./Bits";

const TOOLS: { title: string; line: string; href: string; cta: string }[] = [
  { title: "Competitive audit", line: "Compare two to six sites side by side: type, color, layout, vibe, versus the market and the open territory nobody uses yet.", href: "/audit/new", cta: "Start an audit" },
  { title: "Watchlists", line: "Save a set of brands and signals; get an RSS feed of every confirmed change, stage change and alert. No account: the links are the keys.", href: "/watch/new", cta: "Create a watchlist" },
  { title: "Forecast ledger", line: "Every forecast call we recorded and how it resolved, with the live hit rate once 20 calls resolve.", href: "/ledger", cta: "Read the ledger" },
  { title: "What we show and why", line: "The so-what test: how tiers, composites, Momentum and Confidence decide what you see by default, and where everything lives.", href: "/what-we-show", cta: "Read the rules" },
  { title: "Embeds", line: "Put a live signal chart on your own site or deck: every signal page and chart of the week has an embed panel with the iframe code.", href: "/signals", cta: "Pick a signal" },
  { title: "Agent access (MCP)", line: `Connect an AI agent to ${SITE_URL}/api/public/mcp: 24 read-only tools with the same numbers and receipts. Owner-issued keys raise the rate limit.`, href: "/terminal#mcp", cta: "How to connect" },
];
export function ToolsView() {
  return <DigestShell label="Tools" section="tools">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Tools · act on what you see</p>
      <h1 className="ed-cover mt-3">Where the opening is</h1>
      <p className="ed-standfirst mt-5">Turn signals and brand moves into a decision: audit competitors, watch what matters, and check our record.</p>
    </header>
    <ul className="ed-wrap ed-grid mt-12 gap-y-10">{TOOLS.map(t => <li key={t.title} className="ed-hair pt-4 md:col-span-6 lg:col-span-4">
      <h2 className="ed-h3">{t.title}</h2><p className="ed-small mt-2">{t.line}</p>
      <p className="ed-data mt-2"><AppLink href={t.href} className="ed-tap" {...pr(t.href)}>{t.cta} →</AppLink></p>
    </li>)}</ul>
    <section aria-labelledby="tools-console" className="ed-wrap mt-16">
      <h2 id="tools-console" className="ed-kicker ed-rule pt-3">In context, in the terminal</h2>
      <p className="ed-small mt-2 max-w-[72ch]">Type and palette recommendations, differentiation and critiques run in the terminal console. Brand pages offer “Differentiate from this brand” and “Recommend type for its sector”; signal pages offer “Who uses this well”. Each opens Terminal mode with the command filled in.</p>
      <p className="ed-data mt-3 flex flex-wrap gap-x-6"><AppLink href="/terminal?panel=console" className="ed-tap">Console commands ⇄</AppLink><Link to="/status" className="ed-tap">System status</Link><Link to="/desk" className="ed-tap">Editor's desk</Link></p>
    </section>
    <ReadFooter terminal="/terminal?panel=watch" />
  </DigestShell>;
}

export function StatusView() {
  const { data: health } = useQuery(healthQuery()), { data: mc } = useQuery(modelCardQuery()), { data: runs } = useQuery(runComparisonQuery()), { data: crops, isError: cropsError } = useQuery(cropCoverageQuery());
  const card = mc?.card as Parameters<typeof coverageSentences>[0] & { data_through?: string; median_mae_pts?: number | null; n_forecast_ok?: number; n_traits?: number; ai_provider?: string } | undefined;
  return <DigestShell label="Status" section="tools">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Status · for operators</p>
      <h1 className="ed-cover mt-3">How the machine is running</h1>
      <p className="ed-standfirst mt-5">Scheduled jobs, the forecast model card and data coverage. Readers never need this page; every story and number links to its own receipts.</p>
    </header>
    <section aria-labelledby="st-jobs" className="ed-wrap mt-12">
      <h2 id="st-jobs" className="ed-h2 ed-rule pt-3">Scheduled jobs{health ? ` · ${health.status}` : ""}</h2>
      {!health ? <p className="ed-small mt-3">Checking…</p> : health.jobs.length ? <table className="ed-data mt-4 w-full border-collapse text-left">
        <caption className="sr-only">Scheduled job health</caption>
        <thead><tr className="ed-kicker"><th scope="col" className="py-2 pr-3 font-semibold">Job</th><th scope="col" className="py-2 pr-3 font-semibold">Every</th><th scope="col" className="py-2 pr-3 font-semibold">Last OK</th><th scope="col" className="py-2 font-semibold">Status</th></tr></thead>
        <tbody>{health.jobs.map(j => <tr key={j.job} className="ed-hair align-top"><th scope="row" className="py-2 pr-3 font-normal">{j.job.replace(/_/g, " ")}{j.note && <span className="ed-caption block">{j.note}</span>}</th><td className="py-2 pr-3">{j.expected_every}</td><td className="py-2 pr-3">{j.last_ok_at ? storyTime(j.last_ok_at) : "never"}</td><td className="py-2">{j.stale ? "stale" : j.last_status}{j.consecutive_failures > 0 ? ` · ${j.consecutive_failures} failures` : ""}</td></tr>)}</tbody>
      </table> : <p className="ed-small mt-3">Job health couldn't be read right now.</p>}
      <p className="ed-caption mt-2">Checked {health ? storyTime(health.checked_at) : "—"}. Machine-readable at /api/public/health.</p>
    </section>
    <section aria-labelledby="st-desk" className="ed-wrap mt-14">
      <h2 id="st-desk" className="ed-h2 ed-rule pt-3">Story desk</h2>
      <p className="ed-small mt-3 max-w-[72ch]">What the story engine ran today, what it held and why, with score components and the editor's log.</p>
      <p className="ed-small mt-3 max-w-[72ch]" data-testid="real-runs">{runs ? realRunLine(runs) : "Checking which forecast runs count…"}</p>
      <p className="ed-small mt-3 max-w-[72ch]" data-testid="crop-coverage">{crops ? cropCoverageLine(crops) : cropsError ? "Section crop coverage couldn't be read right now." : "Checking section crops…"}</p>
      <p className="ed-data mt-3"><Link to="/desk" className="ed-tap">Open the editor's desk →</Link></p>
    </section>
    <section aria-labelledby="st-model" className="ed-wrap mt-14">
      <h2 id="st-model" className="ed-h2 ed-rule pt-3">Forecast model card</h2>
      {card ? <dl className="ed-data mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="ed-hair pt-2"><dt className="ed-kicker">Data through</dt><dd>{card.data_through ?? "—"}</dd></div>
        <div className="ed-hair pt-2"><dt className="ed-kicker">Median error</dt><dd>{card.median_mae_pts == null ? "Not scored yet" : `${card.median_mae_pts.toFixed(1)} pts`}</dd></div>
        <div className="ed-hair pt-2"><dt className="ed-kicker">Fitted / signals</dt><dd>{card.n_forecast_ok ?? 0} / {card.n_traits ?? 0}</dd></div>
        <div className="ed-hair pt-2"><dt className="ed-kicker">Computed</dt><dd>{mc ? storyTime(mc.computed_at) : "—"}</dd></div>
      </dl> : <p className="ed-small mt-3">No model card stored yet.</p>}
      {card && <ul className="ed-small mt-4 space-y-1">{coverageSentences(card).map(c => <li key={c}>{c}</li>)}</ul>}
      <p className="ed-data mt-4 flex flex-wrap gap-x-6"><AppLink href="/terminal?panel=brief" className="ed-tap">Full model card in the terminal ⇄</AppLink><Link to="/ledger" className="ed-tap">Forecast ledger</Link><a href="/terminal#m-forecast" className="ed-tap">Methodology</a></p>
    </section>
    <ReadFooter terminal="/terminal?panel=brief" />
  </DigestShell>;
}
