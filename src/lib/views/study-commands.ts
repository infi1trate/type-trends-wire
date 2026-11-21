// U4 · EVERY STUDY FIGURE CAN BE REPRODUCED. Each table behind a study figure has one console command, `study <slug> <figure> [<n>]`,
// that prints that table from the study's model, which is built only from the stored history rows (the same model the study page and
// its Data view draw). The sector lens narrows tables that have brand or sector rows. Pure: the console's server handler only loads the
// stored study and calls `runStudyCommand`; tests run it over fixtures.
import type { Figure, StoryModel } from "../data-stories/types";
/** A study as the console needs it: its address id and its figures. */
export type StudyFigures = Pick<StoryModel, "figures"> & { slug: string };
import { figureTables } from "./figure-tables";
import type { ReceiptTable } from "./receipts";
import { sectorName } from "../labels";

export const STUDY_VERB = "study";
/** The command that prints table `n` (1-based; 1 is left out) of figure `figure` in study `slug`. */
export const studyCommand = (slug: string, figure: string, n = 1) => `${STUDY_VERB} ${slug} ${figure}${n > 1 ? ` ${n}` : ""}`;
/** Every figure table of a study with its command, in the order the Data view shows them. */
export function figureCommands(s: StudyFigures): { figure: string; n: number; caption: string; command: string }[] {
  return Object.entries(s.figures).flatMap(([id, f]) => figureTables(f).map((t, i) => ({ figure: id, n: i + 1, caption: t.caption, command: studyCommand(s.slug, id, i + 1) })));
}
export type StudyArgs = { slug: string; figure: string | null; n: number; sector: string | null };
/** `study <slug> [<figure>] [<n>] [sector=<id>]` → its parts; null when there is no slug. */
export function parseStudyArgs(args: readonly string[]): StudyArgs | null {
  const sector = args.find(a => a.startsWith("sector="))?.slice(7) || null, rest = args.filter(a => !a.startsWith("sector="));
  const [slug, figure, n] = rest;
  if (!slug) return null;
  return { slug: slug.toLowerCase(), figure: figure ?? null, n: n && /^\d+$/.test(n) ? Math.max(1, Number(n)) : 1, sector: sector && sector !== "all" ? sector : null };
}
/** The sector lens on one figure table: adopters and sector panels narrow to the sector; other tables are not by sector and stay whole. */
export function lensTable(fig: Figure, t: ReceiptTable, k: number, sector: string | null): ReceiptTable & { lens: string | null } {
  if (!sector) return { ...t, lens: null };
  if (fig.kind === "adoption" && k === 1) {
    const keep = new Set(fig.adopters.filter(a => a.sector === sector).map(a => a.name));
    return { ...t, rows: t.rows.filter(r => keep.has(r[0]!)), lens: `${sectorName(sector)} only` };
  }
  if (fig.kind === "multiples" && fig.chart === "bars" && fig.panels.some(p => p.id === sector)) {
    const label = fig.panels.find(p => p.id === sector)!;
    return { ...t, rows: t.rows.filter(r => r[0]!.startsWith(label.label)), lens: `${sectorName(sector)} only` };
  }
  if (fig.kind === "field") return { ...t, lens: fig.sector === sector ? null : `This field is ${fig.sectorName}'s; the lens does not change it` };
  return { ...t, lens: "Not by sector: every row shown" };
}
/** The tables of one figure with the lens applied (the study's Data view and the console print the same thing). */
export const lensedFigureTables = (fig: Figure, sector: string | null) => figureTables(fig).map((t, k) => lensTable(fig, t, k, sector));

export type StudyOutput =
  | { kind: "table"; study: string; figure: string; n: number; of: number; command: string; table: ReceiptTable & { lens: string | null } }
  | { kind: "list"; study: string; commands: ReturnType<typeof figureCommands> }
  | { kind: "error"; error: string };
/** Runs a parsed `study` command over a study's model. Without a figure it lists the study's figure commands. */
export function runStudyCommand(s: StudyFigures | null, a: StudyArgs): StudyOutput {
  if (!s) return { kind: "error", error: `No live study "${a.slug}". The studies are listed at /data.` };
  if (!a.figure) return { kind: "list", study: s.slug, commands: figureCommands(s) };
  const fig = s.figures[a.figure];
  if (!fig) return { kind: "error", error: `Study ${s.slug} has no figure "${a.figure}". Figures: ${Object.keys(s.figures).join(", ")}.` };
  const tables = lensedFigureTables(fig, a.sector), t = tables[a.n - 1];
  if (!t) return { kind: "error", error: `Figure ${a.figure} has ${tables.length} table${tables.length === 1 ? "" : "s"}.` };
  return { kind: "table", study: s.slug, figure: a.figure, n: a.n, of: tables.length, command: studyCommand(s.slug, a.figure, a.n), table: t };
}
/** The terminal console with a figure's command prefilled (and run), keeping the lens. */
export const consoleHref = (command: string, sector: string | null) => `/terminal?panel=console&cmd=${encodeURIComponent(sector ? `${command} sector=${sector}` : command)}`;
