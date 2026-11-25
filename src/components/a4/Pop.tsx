// A3 · the sticker in its allowed uses, the NEW mark (shown after hydration so server and browser agree), and the empty state.
import { useEffect, useState, type ReactNode } from "react";
import { Sticker } from "@/components/brand/Containers";
import { STICKER_WORD, isNewStory, type StickerUse } from "@/lib/pop/rules";

export const UseSticker = ({ use }: { use: StickerUse }) => <Sticker className="c-sticker-sm" data-sticker-use={use}>{STICKER_WORD[use]}</Sticker>;

/** "NEW" on a story published in the last 24 hours. `now` given: decided in render; otherwise after hydration. */
export function NewSticker({ at, now }: { at: string; now?: number }) {
  const [t, setT] = useState<number | null>(now ?? null);
  useEffect(() => { if (now == null) setT(Date.now()); }, [now]);
  return t != null && isNewStory(at, t) ? <UseSticker use="new-story" /> : null;
}

/** Empty and quiet states: the mark set large, the existing sentence under it. */
export const EmptyState = ({ mark, children }: { mark: string; children?: ReactNode }) =>
  <div className="empty-state" data-empty-state="">
    <p className="empty-state-mark" aria-hidden="true">{mark}</p>
    {children && <div className="ed-body max-w-[52ch]">{children}</div>}
  </div>;
