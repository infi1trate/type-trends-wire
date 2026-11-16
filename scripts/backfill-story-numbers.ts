// One-off (Phase 18a): give every existing published story its permanent number, in order of happened_at then id. Insert-only and
// idempotent: stories that already have a number are skipped, so later runs only add numbers for stories published since.
// Usage: bun scripts/backfill-story-numbers.ts
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { assignStoryNumbers } = await import("../src/lib/stories/build.server");
const n = await assignStoryNumbers(supabaseAdmin, { sinceDays: null });
const { data } = await supabaseAdmin.from("story_numbers").select("number").order("number");
const nums = (data ?? []).map(r => r.number);
console.log(JSON.stringify({ numbered_now: n, total: nums.length, first: nums[0] ?? null, last: nums.at(-1) ?? null }));
