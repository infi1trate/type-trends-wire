// I3 · 0.2 one-off pass (append-only): re-check every published news story of the last 30 days against the current naming and claim
// rules (candidates.ts newsVerdict) and retire the ones whose item does not report something about how the tracked brand looks, sounds
// or is built. Idempotent: a killed story gets no second edit. Usage: bun scripts/i3-news.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: admin } = await import("../src/integrations/supabase/client.server");
const { dbDeps } = await import("../src/lib/stories/build.server");
const { newsMatcher, newsVerdict, longerNameOf } = await import("../src/lib/stories/candidates");
const { decodeEntities } = await import("../src/lib/entities");
const ex = (await dbDeps(admin as never, false).existing(new Date(Date.now() - 30 * 864e5).toISOString())).filter(s => s.type === "news" && s.state === "published");
const { data: sites } = await admin.from("library_sites").select("domain,name,active");
const m = newsMatcher((sites ?? []).filter(s => s.active), []);
const name = (d: string) => sites?.find(s => s.domain === d)?.name ?? d;
const ids = ex.map(s => Number(s.id.replace(/^news:/, ""))).filter(Number.isFinite);
const { data: wire } = await admin.from("wire_items").select("id,title,url,source,source_kind,excerpt,published_at").in("id", ids);
const out: { id: string; headline: string | null; domains: string[]; verdict: string; note?: string }[] = [];
for (const s of ex) {
  const w = wire?.find(x => `news:${x.id}` === s.id);
  if (!w) { out.push({ id: s.id, headline: s.headline ?? null, domains: s.domains, verdict: "no item" }); continue; }
  const item = { ...w, title: decodeEntities(w.title), excerpt: w.excerpt ? decodeEntities(w.excerpt) : null };
  const v = newsVerdict(m, item);
  const lost = s.domains.filter(d => v.drop || !v.domains.includes(d));
  if (!lost.length) { out.push({ id: s.id, headline: s.headline ?? null, domains: s.domains, verdict: "keeps" }); continue; }
  const d = lost[0]!, longer = longerNameOf(m, d, item.title, item.excerpt, name(d));
  const note = longer ? `Retired: the item names ${longer}, not the tracked brand ${name(d)}` : v.drop === "no_subject" ? `Retired: the item says nothing about how ${name(d)} looks, sounds or is built` : `Retired: the item does not name the tracked brand ${name(d)}`;
  out.push({ id: s.id, headline: s.headline ?? null, domains: s.domains, verdict: v.drop ?? "brand lost", note });
}
const kills = out.filter(o => o.note);
if (!dry && kills.length) { const { error } = await admin.from("story_edits").insert(kills.map(k => ({ story_id: k.id, action: "kill", payload: { reason: k.note }, note: k.note })) as never); if (error) throw error; }
console.log(JSON.stringify({ dry, checked: out.length, out }, null, 1));
