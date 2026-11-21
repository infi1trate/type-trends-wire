// N1 · Part 2: backfill the state history for stories from the last 14 days, from what is stored (the same derivation the pipeline
// uses after each build). Writes only rows that are missing; running it twice writes nothing the second time. No model.
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { syncStoryStates } = await import("../src/lib/newsroom/newsroom.server");
const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 14;
console.log(JSON.stringify({ days, written: await syncStoryStates(db, { days, force: true }) }));
process.exit(0);
