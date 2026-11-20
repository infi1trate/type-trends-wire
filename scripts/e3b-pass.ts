// E3b · one-off pass (append-only; nothing deleted or rewritten). Refuses to append twice: it checks for its own note first.
// No. 90's deck says what its "How we know" says: "…show a sale in two captures at least six hours apart: …". Only the deck changes;
// the count, base and members stay as the E3 recount left them, so no count row is appended.
// Usage: bun scripts/e3b-pass.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { dbDeps, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const deps = dbDeps(db as never, false);
const ID = "census:sale:2026-W47";
const NOTE = "Corrected: the deck now says what How we know says, two captures at least six hours apart";
const OLD = "show a sale in both of our latest captures", NEW = "show a sale in two captures at least six hours apart";
const edits = (await db.from("story_edits").select("id,note").eq("story_id", ID).order("id")).data ?? [];
if (edits.some(e => e.note === NOTE)) { console.log(JSON.stringify({ id: ID, result: "already appended" })); process.exit(0); }
const existing = await deps.existing(new Date(Date.now() - (BUILD_DAYS + 30) * 864e5).toISOString());
const shown = existing.find(e => e.id === ID);
if (!shown || shown.state !== "published" || !shown.deck?.includes(OLD)) { console.log(JSON.stringify({ id: ID, skipped: !shown ? "not found" : shown.state !== "published" ? "not published" : "deck already reads differently", deck: shown?.deck ?? null })); process.exit(0); }
const deck = shown.deck.replace(OLD, NEW);
let result = "dry";
if (!dry) {
  const r = await db.from("story_edits").insert({ story_id: ID, action: "correct", payload: { deck }, note: NOTE } as never);
  if (r.error) throw r.error; result = "appended";
}
console.log(JSON.stringify({ dry, id: ID, before: shown.deck, after: deck, result }, null, 1));
