import { dataInput } from "@/lib/data-stories/data.server";
const i = await dataInput();
const c = (xs: string[]) => Object.entries(xs.reduce((m: any, x) => (m[x] = (m[x] ?? 0) + 1, m), {}));
console.log(c(i.events.map(e => e.source + ":" + e.at.slice(0,4))), c(i.captures.map(e => e.source)));
