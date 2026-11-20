// The rebrand rule (pure, dependency-free): a confirmed identity change reads as a "rebrand" only when its reasons cover
// at least three of four dimensions. Anything less is an identity change, told in plain move wording. Seasonal skins never count.
export const REBRAND_DIMENSIONS = ["type", "colour", "theme", "layout"] as const;
export type RebrandDimension = (typeof REBRAND_DIMENSIONS)[number];
/** Rebrand desk reasons → dimension. Palette and accent are one dimension (colour), counted once. */
export const REBRAND_DIMENSION_OF: Record<string, RebrandDimension> = { font: "type", palette: "colour", accent: "colour", theme: "theme", redesign: "layout" };
export const REBRAND_MIN_DIMENSIONS = 3;
export const REBRAND_LABEL = "Rebrand", IDENTITY_LABEL = "Identity change", IDENTITY_LIST_LABEL = "Identity changes";

export const rebrandDimensions = (reasons: readonly string[]): RebrandDimension[] => REBRAND_DIMENSIONS.filter(d => reasons.some(r => REBRAND_DIMENSION_OF[r] === d));
/** Only a change across three or more dimensions, on a capture that is not a seasonal promotion, may be called a rebrand. */
export const isRebrand = (r: { reasons: readonly string[]; seasonal?: boolean | null | undefined }) => !r.seasonal && rebrandDimensions(r.reasons).length >= REBRAND_MIN_DIMENSIONS;
export const identityLabel = (r: { reasons: readonly string[]; seasonal?: boolean | null | undefined }) => (isRebrand(r) ? REBRAND_LABEL : IDENTITY_LABEL);

/** Plain words for what changed, in reason order: "font", "accent and palette", "font and homepage layout". */
const PLAIN: Record<string, string> = { font: "font", accent: "accent", palette: "palette", theme: "theme", redesign: "homepage layout" };
const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
export const changedWhat = (reasons: readonly string[]) => join([...new Set(reasons.map(r => PLAIN[r] ?? r))]) || "identity";
/** "lucidmotors.com changed its font" — the headline for an identity change that is not a rebrand. */
export const identitySentence = (domain: string, reasons: readonly string[]) => `${domain} changed its ${changedWhat(reasons)}`;

/** The reader-facing rule (rules.ts, /what-we-show). */
export const REBRAND_RULE = `A change is called a rebrand only when it covers at least ${REBRAND_MIN_DIMENSIONS} of ${REBRAND_DIMENSIONS.length} identity dimensions (type, colour, theme and layout; palette and accent count once as colour); anything less is an ordinary move with a plain headline.`;
