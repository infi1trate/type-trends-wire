// Y2 · the "Why now" backfill: the 20 highest-momentum headline signals and the eight studies. Run ONLY after the story writer's new
// voice has been scored and the Why-now writer has a passing golden score (writeWhyNow refuses otherwise). Each block is one writer
// call under the "why_now" ledger kind, inside the weekly cap. Usage: bun scripts/why-now-backfill.ts [--dry]
import { latestSignals } from "../src/lib/signals.server";
import { DATA_STORIES } from "../src/lib/data-stories/registry";
import { buildDossiers } from "../src/lib/evidence/evidence.server";
import { writeWhyNow } from "../src/lib/evidence/whynow.server";
const dry = process.argv.includes("--dry");
const { signals } = await latestSignals("all");
const top = signals.filter(s => s.tier === "headline").sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1)).slice(0, 20);
// The eight live, listed studies; a study whose question is not about one signal uses the signal its figures lead with, else none.
const studies = DATA_STORIES.filter(e => e.status === "live" && !e.hidden).slice(0, 8).map(e => ({ slug: e.slug, signal: (e.params as { signal?: string }).signal ?? "" }));
await buildDossiers({ only: [...new Set([...top.map(s => s.key), ...studies.map(s => s.signal).filter(Boolean)])], budgetMs: 170_000 });
const fig = (s: (typeof signals)[number]) => [{ id: "share", text: `${s.share == null ? "—" : `${(s.share * 100).toFixed(1)}%`} of the homepages slug reads` }, ...(s.momentum != null ? [{ id: "momentum", text: `${(s.momentum * 100).toFixed(1)} points a quarter` }] : [])];
for (const s of top) console.log("signal", s.key, dry ? "(dry)" : JSON.stringify(await writeWhyNow("signal", s.key, s.key, fig(s))));
for (const st of studies) { const s = signals.find(x => x.key === st.signal); console.log("study", st.slug, dry || !s ? "(dry or no signal)" : JSON.stringify(await writeWhyNow("study", st.slug, st.signal, fig(s)))); }
