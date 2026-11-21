// U1 Part 3 · "No. 88 →" at the end of a data row whose subject a published story reports. One batched read (storyRowsQuery) per page,
// shared by every row through the query cache; a row with no story renders nothing.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { storyRowsQuery } from "@/lib/data";
import { storyForRow, storyLookup, type RowRef } from "@/lib/views/story-rows";
import { AppLink } from "@/components/terminal/AppLink";

export function useStoryLookup() {
  const { data } = useQuery(storyRowsQuery());
  return useMemo(() => storyLookup(data ?? []), [data]);
}
export function StoryLink({ row, className = "" }: { row: RowRef; className?: string }) {
  const lookup = useStoryLookup(), s = storyForRow(lookup, row);
  if (!s) return null;
  return <AppLink href={s.href} className={`label inline-flex min-h-[44px] items-center whitespace-nowrap text-highlight underline-offset-2 hover:underline md:min-h-6 ${className}`} data-story-for-row={s.number} aria-label={`Story No. ${s.number}`}>{s.text}</AppLink>;
}
