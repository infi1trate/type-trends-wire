// One composition per page type (brand/README.md, "Layout moves" and "Space"): its density, the containers it may use (only the
// eight), at most one Plate, and the one illustration style its cover carries. Pure; compositions.test.tsx checks each against the
// density map in ia.ts and against the rendered page.
import type { ContainerName } from "@/components/brand/Containers";
import type { IllustrationStyle } from "./illustration";
import type { Density } from "./ia";

export type Composition = { routes: readonly string[]; density: Density; containers: readonly ContainerName[]; plates: 0 | 1; illustration: IllustrationStyle | null; what: string };
export const COMPOSITIONS = {
  front: { routes: ["index"], density: "steady", containers: ["plate", "rulebox", "raised", "sticker", "card", "slab"], plates: 1, illustration: "trail", what: "The lead plate with its figure and trail; the live column as a Ledger." },
  story: { routes: ["stories.$id", "stories.no.$number"], density: "quiet", containers: ["slab", "card", "rulebox", "photo", "raised", "sticker"], plates: 0, illustration: "cut", what: "An ink cover with the headline crossing one tilted object; the off-centre column; Related as a Ledger." },
  signal: { routes: ["signals.$key", "trait.$key"], density: "quiet", containers: ["rulebox", "raised", "sticker", "card"], plates: 0, illustration: "trail", what: "The name, one figure with Momentum and Confidence as facts, the share trail; rule boxes; Ledgers." },
  brand: { routes: ["brands.$domain"], density: "steady", containers: ["rulebox", "card", "photo", "raised"], plates: 0, illustration: null, what: "Name in H1, the facts row, the sections as a tile wall of two sizes, history as a Ledger." },
  pattern: { routes: ["patterns.$key"], density: "steady", containers: ["rulebox", "card", "photo", "raised"], plates: 0, illustration: null, what: "Name in H1, the facts row, the examples as a tile wall of two sizes, related as a Ledger." },
  digest: { routes: ["digest.$week", "digest.index"], density: "quiet", containers: ["sheet", "rulebox", "sticker", "card", "raised"], plates: 0, illustration: "soft", what: "A cover with the issue number as a soft object, contents as a Ledger, sections as rule boxes." },
  morning: { routes: ["morning.index", "morning.$date"], density: "quiet", containers: ["sheet", "rulebox", "sticker", "raised"], plates: 0, illustration: "soft", what: "A cover with the day's count as a soft object, today's stories as a Ledger, sections as rule boxes." },
  sector: { routes: ["sectors.$sector"], density: "quiet", containers: ["sheet", "rulebox", "card", "photo"], plates: 0, illustration: "soft", what: "Print-first: the sector name in Display, one figure, small multiples, Ledgers of movers and leaders." },
  gallery: { routes: ["patterns.index", "collections.index", "collections.$slug"], density: "steady", containers: ["rulebox", "raised", "card"], plates: 0, illustration: null, what: "A wall of capture tiles on the 8px grid in two sizes, filters in a rule box, a Raised More; indexes as Ledgers." },
  report: { routes: ["audit.index"], density: "quiet", containers: ["sheet", "rulebox", "card", "raised"], plates: 0, illustration: null, what: "Print-first: the audited domains in Display, one figure, findings as a Ledger with their marks, the page in its sector's field." },
  "data-index": { routes: ["data.index"], density: "steady", containers: ["rulebox", "card", "raised"], plates: 0, illustration: null, what: "The Studies home: lead study, series, the in-the-works shelf and the brand tool." },
  "data-story": { routes: ["data.$slug", "data.where-you-sit"], density: "quiet", containers: ["card", "sheet", "raised", "rulebox"], plates: 0, illustration: "trail", what: "The picture in 7 of 12 columns, numbered caption cards in 5, Raised stepper controls." },
  tools: { routes: ["tools", "audit.new", "watch.$id", "watch.new", "status", "what-we-show", "ledger"], density: "steady", containers: ["rulebox", "raised", "card"], plates: 0, illustration: null, what: "Forms as rule boxes with Raised submits; results as Ledgers; status as a ruled table, red only on what is late." },
  editions: { routes: ["editions", "digest.archive", "sectors.index"], density: "steady", containers: ["rulebox"], plates: 0, illustration: null, what: "Archives and indexes as Ledgers." },
} as const satisfies Record<string, Composition>;
export type CompositionId = keyof typeof COMPOSITIONS;
