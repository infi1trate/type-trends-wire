// B2 · one-time fill of the lead-and-lag counts (the weekly structure follow-up keeps them current).
import { refreshLeadLag } from "../src/lib/leadlag.server";
console.log(JSON.stringify(await refreshLeadLag()));
