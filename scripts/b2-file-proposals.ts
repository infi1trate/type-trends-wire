// B2 · files the three new proposed chart forms as graphics-desk proposals (one each), so the owner accepts each with one action on
// the desk page. Accepting stays the owner's; this files only.
import { deskDoor } from "../src/lib/stories/desk.server";
import { formById } from "../src/lib/chart/forms";
const why: Record<string, string> = {
  "adoption-wake": "Study No. 2's “who showed it first” square grid and the signal pages cannot show who went first and how big the crowd that followed was in one figure",
  "lead-lag": "no live form shows whether the vanguard leads everyone else, by how much and for how long; it is the lead figure of the held study “Do the leaders lead?”",
  "page-anatomy": "the brand page's sections strip, sector and category pages and the held study “How a homepage is built” need one strip form for one page, many pages and the typical page per year",
};
for (const id of ["adoption-wake", "lead-lag", "page-anatomy"]) {
  const f = formById(id)!;
  const text = `B2: ${why[id]}. The registry's proposed form “${f.name}” (${f.id}) would fit. Specimens on real data at /brand/system#b2. Filed by the graphics desk; nothing is drawn with it on reader pages until the owner accepts and a gated build makes it live.`;
  const r = await deskDoor("graphics", { action: "propose", kind: "format", text: text.slice(0, 600), subject: id });
  console.log(id, r.status, JSON.stringify(r.body ?? r).slice(0, 200));
}
