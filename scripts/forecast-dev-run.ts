// Sandbox forecast run: stores a new run and its rows only. No brief, chart, alerts, ledger calls, taste/vibe rewrites or pruning.
// Usage: bun scripts/forecast-dev-run.ts
import { DEV_RUN } from "../src/lib/forecast-run";
const { runForecast } = await import("../src/lib/forecast.server");
const r = await runForecast(DEV_RUN);
console.log(JSON.stringify({ run_id: r.run_id, steps: r.steps, alerts: r.alerts, brief: r.brief, ledger: r.ledger, taste: r.taste, vibe: r.vibe, n_traits: (r.model_card as { n_traits?: number }).n_traits, component_coverage: (r.model_card as { component_coverage?: unknown }).component_coverage }, null, 1));
