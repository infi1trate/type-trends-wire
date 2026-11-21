/** /stories/no/<n>?… → the story's id address with the same query string (view, receipt, sector and anything else). Pure. */
export function storyNumberTarget(id: string, searchStr: string): string {
  const q = searchStr && searchStr !== "?" ? (searchStr.startsWith("?") ? searchStr : `?${searchStr}`) : "";
  return `/stories/${encodeURIComponent(id)}${q}`;
}
