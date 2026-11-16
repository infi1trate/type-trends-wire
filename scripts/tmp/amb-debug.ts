import { loadAmbient } from "@/lib/ambient/ambient.server";
const a = await loadAmbient("all");
console.log(JSON.stringify({ lead: !!a.lead, stories: a.stories.length, chart: !!a.chart, move: a.move && { d: a.move.domain, at: a.move.at }, collection: a.collection?.tiles.length, figure: a.figure, data: a.data && a.data.slug }, null, 1));
