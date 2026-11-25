// Y1 · builds the evidence desk's dossiers now (the weekly page-structure follow-up does this every week). No model calls.
import { buildDossiers } from "../src/lib/evidence/evidence.server";
const only = process.argv.slice(2).filter(a => a.includes(":"));
console.log(JSON.stringify(await buildDossiers({ budgetMs: 170_000, ...(only.length ? { only } : {}) })));
