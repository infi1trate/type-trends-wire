import { loadDataIndex, loadDataStory, loadWhereYouSit } from "@/lib/data-stories/page.server";
import { capText } from "@/lib/data-stories/text";
console.log(JSON.stringify((await loadDataIndex()).rows.map(r => [r.number, r.status, r.question])));
for (const s of ["software-homepage-five-years","who-went-big-first","which-sector-changes-its-mind","where-did-fintechs-colour-go"]) {
  const p = await loadDataStory(s);
  if (p.kind !== "live") { console.log(s, p.kind, (p as any).reason); continue; }
  console.log("\n##", p.story.number, p.story.question, "| key", p.story.key.n, p.story.key.label, "| figs", Object.keys(p.story.figures).join(","), "| bytes", JSON.stringify(p.story).length);
  p.story.steps.forEach((st, k) => console.log(k + 1, st.view.figure, "|", capText(st.caption)));
  console.log("basis", JSON.stringify(p.story.basis));
}
for (const d of ["stripe.com", "linear.app"]) { const w = await loadWhereYouSit(d); if (w.kind === "story") { console.log("\n## where", d, JSON.stringify(w.story).length); w.story.steps.forEach((st, k) => console.log(k + 1, capText(st.caption))); } else console.log(d, w.kind); }
console.log((await loadWhereYouSit("example.com")).kind);
