// W3d-c · the data API answers at most 1,000 rows a request whatever `.limit()` asks for, so a count or a list that may pass 1,000 rows
// is read in pages with `.range()`. Pure over the page function; the answer keeps the `{ data, error }` shape callers already read.
export const PAGE_ROWS = 1000;
export async function pagedRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 20_000): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE_ROWS) break;
  }
  return { data: out, error: null };
}
