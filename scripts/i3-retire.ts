// I3 · one-off pass (append-only): re-check every published story of the last 30 days whose changes are now marked re-reads or failed
// measurements (library_event_marks) and retire the ones left without support (retire.ts rereadRetire). Idempotent: a story already
// killed gets no second edit. Usage: bun scripts/i3-retire.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: admin } = await import("../src/integrations/supabase/client.server");
const { dbDeps } = await import("../src/lib/stories/build.server");
const { retireRereadStories } = await import("../src/lib/stories/reread-retire.server");
const ex = await dbDeps(admin as never, false).existing(new Date(Date.now() - 30 * 864e5).toISOString());
const out = await retireRereadStories(admin as never, ex, { dry });
console.log(JSON.stringify({ dry, ...out }, null, 1));

