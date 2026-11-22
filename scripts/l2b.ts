// L2b proof: `bun scripts/l2b.ts ask|order|phase-test`. Door calls go through the door's own code (handleDesk) with the editor key
// check replaced by a stub; the phase item is marked as a test.
const cmd = process.argv[2];
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { handleDesk, prodDeps } = await import("../src/lib/stories/desk.server");
const deps = { ...(await prodDeps()), authorize: async () => true, allow: () => true };
const post = async (body: unknown) => { const r = await handleDesk(new Request("https://slug.global/api/public/desk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), deps); return { status: r.status, body: await r.json() }; };
const out = (x: unknown) => console.log(JSON.stringify(x, null, 1));
const N43 = "breakout:css:scroll_timeline:all:13";
if (cmd === "ask") {
  out(await post({ actor: "standards", action: "rewrite", id: N43, reason: "The deck calls the share flat while its numbers give momentum of at least 0.5 points a quarter (the A4 rule); rewrite through the normal check." }));
  out(await post({ actor: "standards", action: "rewrite", id: N43, reason: "A second ask while the first is open must be refused." }));
}
if (cmd === "order") {
  const { storiesToWrite } = await import("../src/lib/stories/build.server");
  const { writerIO } = await import("../src/lib/stories/writer.server");
  const q = await storiesToWrite(db as never, [], 12, true);
  const used = await writerIO(db as never).used();
  out({ writer_calls_used_today: used, queue: q.map((s, i) => `${i + 1}. ${s.id}`) });
}
if (cmd === "phase-test") {
  out(await post({ actor: "engineering", action: "queue_add", kind: "phase", phase: "L2b", title: "Test: the queue takes a phase item", why: "Proof that the widened kind list and the phase column accept a phase item (marked as a test).", expects: "no visible change", test: true }));
}
process.exit(0);
