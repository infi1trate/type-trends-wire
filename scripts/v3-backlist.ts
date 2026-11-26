// V3 · the backlist: files one rewrite request per published story through the door as the copy desk, newest first, so the story writer
// rewrites them to Voice guide 2 at its normal allowance (12 a day, inside the weekly cap, through the cost ledger), first in its queue.
// A rewrite that changes a number, date or brand is refused by the writer's check and the story keeps its text; held stories are never
// asked. HAND-RUN ONLY, and only once the V2 writer is the deployed one (otherwise the live writer would rewrite in the old voice):
//   bun scripts/v3-backlist.ts --deployed            files the requests (one door call each, logged with the copy desk as actor)
//   bun scripts/v3-backlist.ts --deployed --limit 3  files at most 3 (the newest not yet asked)
//   bun scripts/v3-backlist.ts --count               counts published stories and open V3 requests; writes nothing
// Undo: the door's `text_restore` with id "all" (or one story id) stores each story's earlier text again as its newest version.
import { V3_REASON, isV3Request } from "../src/lib/stories/restore";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { applyEdits } = await import("../src/lib/stories/edits");
const rows: { id: string; type: string; happened_at: string }[] = [];
for (let f = 0; ; f += 1000) { const { data, error } = await db.from("stories").select("*").neq("type", "launch").order("id").range(f, f + 999); if (error) throw error; rows.push(...(data as never[])); if (!data || data.length < 1000) break; }
const ids = rows.map(r => r.id), edits: { story_id: string }[] = [];
for (let i = 0; i < ids.length; i += 200) { const { data } = await db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids.slice(i, i + 200)).order("id"); edits.push(...((data ?? []) as never[])); }
const shown = rows.map(r => applyEdits(r as never, edits.filter(e => e.story_id === r.id) as never, Date.now())).filter(s => s.state === "published").sort((a, b) => b.happened_at.localeCompare(a.happened_at));
const { data: asks } = await db.from("rewrite_requests").select("story_id,reason").like("reason", "V3 ·%").limit(1000);
const asked = new Set((asks ?? []).filter(a => isV3Request(a.reason)).map(a => a.story_id));
console.log(JSON.stringify({ published: shown.length, already_asked: asked.size }));
if (!process.argv.includes("--deployed")) process.exit(0);
const { deskDoor } = await import("../src/lib/stories/desk.server");
const li = process.argv.indexOf("--limit"), limit = li > 0 ? Number(process.argv[li + 1]) : Infinity;
if (!(limit > 0)) throw new Error("--limit needs a positive number");
let filed = 0, refused = 0;
for (const s of shown) { if (filed + refused >= limit) break; if (asked.has(s.id)) continue; const r = await deskDoor("copy desk", { action: "rewrite", id: s.id, reason: V3_REASON }); if (r.status === 201) { filed++; console.log(JSON.stringify({ filed: s.id, slug: (s as { slug?: string }).slug })); } else refused++; }
console.log(JSON.stringify({ filed, refused }));
process.exit(0);
