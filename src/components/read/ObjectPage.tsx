// One anatomy for every object page in Read mode: HEADLINE → EVIDENCE → SO WHAT → RELATED. The order lives in ia.ts and cannot drift.
import type { ReactNode } from "react";
import { BLOCK_TITLE, OBJECT_BLOCKS, type Block, type ObjectType } from "@/lib/ia";

export type ObjectBlocks = Record<Block, ReactNode>;
export function ObjectPage({ kind, id, blocks }: { kind: ObjectType; id: string; blocks: ObjectBlocks }) {
  return <article aria-labelledby={`${id}-title`} data-object={kind}>
    {OBJECT_BLOCKS.map((b, i) => b === "headline"
      ? <header key={b} data-block={b} className="ed-wrap pt-8 md:pt-12">{blocks[b]}</header>
      : <section key={b} data-block={b} aria-labelledby={`${id}-${b}`} className="ed-wrap mt-14">
        <header className="ed-rule mb-6 flex flex-wrap items-baseline gap-x-4 pt-3"><span className="ed-kicker">{String(i).padStart(2, "0")}</span><h2 id={`${id}-${b}`} className="ed-h2">{BLOCK_TITLE[b]}</h2></header>
        {blocks[b]}
      </section>)}
  </article>;
}
/** A sub-heading inside a block. */
export const BlockPart = ({ title, kicker, children }: { title: string; kicker?: string | undefined; children: ReactNode }) =>
  <div className="mt-10 first:mt-0"><h3 className="ed-kicker">{title}</h3>{kicker && <p className="ed-caption mt-1 max-w-[72ch]">{kicker}</p>}<div className="mt-3">{children}</div></div>;
