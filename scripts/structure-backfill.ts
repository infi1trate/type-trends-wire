// J1 · one-time fill of the structure records from every stored HOME capture (the weekly step then keeps it current from its bookmark).
import { refreshStructure } from "../src/lib/structure.server";
for (let i = 0; i < 40; i++) {
  const r = await refreshStructure({ budgetMs: 50_000 });
  console.log(JSON.stringify(r));
  if (!r.ok || r.done) break;
}
