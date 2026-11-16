// DATA STORIES — shared shapes. A story is a question answered by a picture you step through; every step is a caption of one or two
// sentences plus a view state for the picture. All of it is plain JSON (SSR-serializable) built by pure code from stored data.

/** A number in a caption: what is shown, the raw value and its receipt. Captions never carry a digit outside one of these. */
export type Num = { n: string; v: number; href: string };
/** A named thing in a caption (a brand, a signal, a sector), linked to its page. Names may contain digits ("Immersive 3D"). */
export type Ref = { r: string; href: string };
export type Seg = string | Num | Ref;
export type Caption = Seg[];

/** What the picture shows at a step. Each figure reads the fields it understands and ignores the rest. */
export type View = {
  figure: string;
  /** Ids to bring forward: panels, brands, palette buckets, events. */
  highlight: string[];
  /** One focal item: a quarter (adoption, drift), a cluster id or "centre" (field), a frame id (strip). */
  focus?: string | null;
  /** Before / after: which side the slider rests on. */
  side?: "before" | "after" | "split";
};
export type Step = { id: string; caption: Caption; view: View };

// FIGURES ------------------------------------------------------------------------------------------
export type Point = { x: string; y: number };
export type MultiplesPanel = { id: string; label: string; href: string; points: Point[]; /** Optional second series drawn as ticks (e.g. rebrands). */ marks?: Point[] };
export type MultiplesFig = { kind: "multiples"; title: string; note: string; unit: "share" | "count"; chart: "line" | "bars"; xs: string[]; yMax: number; panels: MultiplesPanel[] };

export type Adopter = { domain: string; name: string; sector: string; first: string; firstAt: string; censored: boolean; dropped: boolean; href: string };
export type AdoptionFig = { kind: "adoption"; title: string; note: string; signal: { key: string; name: string; href: string }; quarters: string[]; share: Point[]; adopters: Adopter[]; never: number; total: number };

export type FieldAxis = { key: string; label: string; measure: string; unit: "px" | "share" };
export type FieldPoint = { domain: string; name: string; x: number; y: number; cluster: number; href: string };
export type FieldFig = {
  kind: "field"; title: string; note: string; sector: string; sectorName: string; axes: { x: FieldAxis; y: FieldAxis };
  points: FieldPoint[]; missing: number; centre: { x: number; y: number }; clusters: { id: number; label: string; n: number; x: number; y: number }[];
  extremes: { id: string; domain: string; label: string }[];
};

export type Swatch = { id: string; hex: string; w: number };
export type DriftBand = { q: string; brands: number; swatches: Swatch[] };
export type DriftFig = { kind: "drift"; title: string; note: string; scope: string; bands: DriftBand[] };

/** One stored capture redrawn from its skeleton: compact boxes in page pixels, the capture's own colours, and a crop when one exists. */
export type BoxKind = "h" | "t" | "c" | "m" | "s" | "o";
export type Box = [BoxKind, number, number, number, number];
export type Frame = {
  id: string; at: string; source: "live" | "wayback"; w: number; h: number; bg: string | null; ink: string | null; accent: string | null; tones: string[];
  boxes: Box[]; crop: { src: string; width: number; height: number; alt: string } | null; archiveUrl: string | null;
};
export type Diff = { field: string; before: string; after: string };
export type BeforeAfterFig = { kind: "before-after"; title: string; note: string; domain: string; name: string; href: string; before: Frame; after: Frame; diffs: Diff[] };
export type StripMark = { id: string; at: string; type: string; label: string; after: string | null };
export type StripFig = { kind: "strip"; title: string; note: string; domain: string; name: string; href: string; frames: Frame[]; marks: StripMark[] };

export type Figure = MultiplesFig | AdoptionFig | FieldFig | DriftFig | BeforeAfterFig | StripFig;
export type FigureKind = Figure["kind"];

// STORIES ------------------------------------------------------------------------------------------
export type Basis = { brands: number; captures: number; period: string; rule: string; lines: string[] };
export type Link = { label: string; href: string };
export type StoryModel = {
  slug: string; number: number; question: string; deck: string; template: string; dataThrough: string | null;
  figures: Record<string, Figure>; steps: Step[]; basis: Basis; collection: Link; related: Link[];
  /** The one figure a share image and the index lead with. */
  key: { n: string; label: string };
};
