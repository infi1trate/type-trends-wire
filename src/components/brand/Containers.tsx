// The brand's eight containers (brand/README.md, "Containers"), with their rules built in. Styles live in src/styles.css (.c-*).
// Square is print, round is object: only Sticker is round. A hard shadow exists only on Raised (things you press) and Sticker.
// One Plate per screen; two levels deep at most; lists are ruled tables (see Ledger), not stacks of cards.
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Receipt } from "@/components/read/StoryCard";

export const CONTAINER_NAMES = ["sheet", "rulebox", "card", "slab", "plate", "raised", "sticker", "photo"] as const;
export type ContainerName = (typeof CONTAINER_NAMES)[number];
/** What each container is for and what it must never be (shown on /brand/containers and /kit). */
export const CONTAINER_RULES: Record<ContainerName, { name: string; use: string; never: string }> = {
  sheet: { name: "Sheet", use: "The page.", never: "A border or a fill." },
  rulebox: { name: "Rule box", use: "A 3 px ink border, for grouping an index, a table, a set of charts.", never: "A fill or a shadow." },
  card: { name: "Card", use: "White with a 3 px border, for anything read as a unit.", never: "A shadow, or a stack of them for a list." },
  slab: { name: "Slab", use: "Ink, for navigation, the ticker, footers, the night desk.", never: "Reading text longer than a line." },
  plate: { name: "Plate", use: "A colour fill with a border, for the one loud thing on a screen.", never: "A second one on the same screen." },
  raised: { name: "Raised", use: "A hard 6 px shadow, for things you press.", never: "Anything you cannot press." },
  sticker: { name: "Sticker", use: "Round, tilted, with a short hard shadow, for a note on top of the layout.", never: "Square, or holding a paragraph." },
  photo: { name: "Photo plate", use: "The picture runs full; anything you read sits on an ink strip.", never: "Reading text set on the photograph." },
};

type Box = HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "aside" | "article" | "header" | "footer" | "nav"; children?: ReactNode };
const box = (name: ContainerName) => function C({ as: Tag = "div", className = "", children, ...rest }: Box) {
  return <Tag data-container={name} className={`c-${name} ${className}`.trim()} {...rest}>{children}</Tag>;
};
export const Sheet = box("sheet");
export const RuleBox = box("rulebox");
export const Card = box("card");
export const Slab = box("slab");
/** The one loud thing on a screen. Render at most one per page (front.test / containers.test check the models). */
export const Plate = box("plate");

/** Raised: something you press. A link (href) or a button; never a static box. */
export function Raised(p: ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)) {
  if (p.href !== undefined) { const { href, className = "", children, ...rest } = p; return <Receipt href={href} data-container="raised" className={`c-raised ${className}`.trim()} {...rest}>{children}</Receipt>; }
  const { className = "", children, type = "button", ...rest } = p as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type={type} data-container="raised" className={`c-raised ${className}`.trim()} {...rest}>{children}</button>;
}
/** Sticker: a short note on top of the layout (a control or a stamp), round and tilted. */
export function Sticker({ className = "", children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return onClick ? <button type="button" data-container="sticker" className={`c-sticker ${className}`.trim()} onClick={onClick} {...rest}>{children}</button>
    : <span data-container="sticker" className={`c-sticker ${className}`.trim()}>{children}</span>;
}
/** Photo plate: the picture runs full; the caption and anything read sits on an ink strip below it. */
export function PhotoPlate({ media, children, className = "" }: { media: ReactNode; children?: ReactNode; className?: string }) {
  return <figure data-container="photo" className={`c-photo ${className}`.trim()}>{media}{children && <figcaption className="c-photo-strip">{children}</figcaption>}</figure>;
}
