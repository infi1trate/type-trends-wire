import { line } from "../voice";
// THE AMBIENT BOARD (/ambient): the scenes a studio wall plays, built by ONE pure function from data the front page, the gallery, the
// Morning Line and the data stories already load. No I/O, no clock, no randomness: the same input gives the same playlist.
import type { PageState, TickerItem } from "../front/front";
import type { GalleryTile } from "../gallery";
import type { BeforeAfterFig, Figure, Step } from "../data-stories/types";
import { LENS_SECTORS } from "../sector-lens";

/** Scene ids in their default order. */
export const SCENE_IDS = ["cover", "ledger", "trail", "pair", "wall", "figure", "data"] as const;
export type SceneId = (typeof SCENE_IDS)[number];
export const SCENE_NAME: Record<SceneId, string> = { cover: "The lead story", ledger: "The newest stories", trail: "The chart of the day", pair: "A recent move", wall: "A collection", figure: "The day's figure", data: "A data story" };
/** Seconds each scene stays: 24 by default, 10 to 120 from ?dwell=. */
export const DWELL = { default: 24, min: 10, max: 120 } as const;
export const LEDGER_SIZE = 5, WALL_SIZE = 12;

export type AmbientStory = { id: string; number: number | null; headline: string; typeName: string; sector: string | null; sectorName: string | null; at: string; line: string | null };
export type AmbientInput = {
  now: string; today: string; state: PageState; sector: string; ticker: TickerItem[];
  freshness: { text: string; late: boolean } | null;
  lead: (AmbientStory & { label: string; why: string | null }) | null;
  /** Newest live stories, newest first (the lead may be among them). */
  stories: AmbientStory[];
  chart: { title: string; name: string; note: string; points: { x: string; y: number }[] } | null;
  move: { domain: string; name: string; text: string; at: string; pair: BeforeAfterFig } | null;
  collection: { slug: string; number: number; title: string; tiles: GalleryTile[] } | null;
  figure: { value: string; name: string; caption: string; key: string } | null;
  data: { slug: string; number: number; question: string; key: { n: string; label: string }; step: Step; figure: Figure } | null;
};
export type Scene =
  | { id: "cover"; lead: NonNullable<AmbientInput["lead"]> }
  | { id: "ledger"; stories: AmbientStory[] }
  | { id: "trail"; chart: NonNullable<AmbientInput["chart"]> }
  | { id: "pair"; move: NonNullable<AmbientInput["move"]> }
  | { id: "wall"; collection: NonNullable<AmbientInput["collection"]> }
  | { id: "figure"; figure: NonNullable<AmbientInput["figure"]> }
  | { id: "data"; data: NonNullable<AmbientInput["data"]> };

export type AmbientOptions = { dwell: number; sector: string; scenes: SceneId[] };
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
/** ?dwell= (seconds, clamped 10–120, 24 when absent or not a number), ?sector= (the lens), ?scenes= (a comma list, unknown ids dropped). */
export function parseAmbient(raw: Record<string, unknown>): AmbientOptions {
  const d = Number(String(one(raw["dwell"]) ?? "").trim());
  const dwell = String(one(raw["dwell"]) ?? "").trim() !== "" && Number.isFinite(d) ? Math.min(DWELL.max, Math.max(DWELL.min, Math.round(d))) : DWELL.default;
  const s = one(raw["sector"]), sector = typeof s === "string" && LENS_SECTORS.includes(s) ? s : "all";
  const list = String(one(raw["scenes"]) ?? "").split(",").map(x => x.trim().toLowerCase()).filter((x): x is SceneId => (SCENE_IDS as readonly string[]).includes(x));
  return { dwell, sector, scenes: list.length ? [...new Set(list)] : [...SCENE_IDS] };
}
/** The URL search for a set of options, defaults left out. */
export function ambientSearch(o: AmbientOptions): Record<string, string> {
  return { ...(o.dwell !== DWELL.default ? { dwell: String(o.dwell) } : {}), ...(o.sector !== "all" ? { sector: o.sector } : {}), ...(o.scenes.join(",") !== SCENE_IDS.join(",") ? { scenes: o.scenes.join(",") } : {}) };
}
/** The scenes to play, in the requested order; a scene with nothing to show is skipped. The lens puts its sector's stories first. */
export function playlist(i: AmbientInput, o: Pick<AmbientOptions, "scenes" | "sector">): Scene[] {
  const inLens = (s: AmbientStory) => o.sector !== "all" && s.sector === o.sector;
  const rest = i.stories.filter(s => s.id !== i.lead?.id);
  const ledger = [...rest.filter(inLens), ...rest.filter(s => !inLens(s))].slice(0, LEDGER_SIZE);
  const build: Record<SceneId, () => Scene | null> = {
    cover: () => (i.lead ? { id: "cover", lead: i.lead } : null),
    ledger: () => (ledger.length ? { id: "ledger", stories: ledger } : null),
    trail: () => (i.chart && i.chart.points.length >= 2 ? { id: "trail", chart: i.chart } : null),
    pair: () => (i.move && i.move.pair.before.boxes.length && i.move.pair.after.boxes.length ? { id: "pair", move: i.move } : null),
    wall: () => (i.collection && i.collection.tiles.length >= WALL_SIZE ? { id: "wall", collection: { ...i.collection, tiles: i.collection.tiles.slice(0, WALL_SIZE) } } : null),
    figure: () => (i.figure ? { id: "figure", figure: i.figure } : null),
    data: () => (i.data ? { id: "data", data: i.data } : null),
  };
  return o.scenes.map(id => build[id]()).filter((s): s is Scene => s !== null);
}
/** What the board says with nothing to play. */
export const EMPTY_BOARD_LINE = line("ambient.empty");
/** A stable signature of what the board shows, so a poll only rebuilds the playlist when something changed. */
export const playlistKey = (ss: Scene[]) => ss.map(s => `${s.id}:${s.id === "cover" ? s.lead.id : s.id === "ledger" ? s.stories.map(x => x.id).join("|") : s.id === "trail" ? s.chart.points.length : s.id === "pair" ? s.move.at : s.id === "wall" ? s.collection.slug : s.id === "figure" ? s.figure.value : s.data.slug}`).join(",");
