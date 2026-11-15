// Specimen stylesheet links for an issue's Google Fonts (subset to the characters shown). Pure.
import type { Issue } from "./issue";
import { specimenLink } from "./meta";
export function specimenLinks(i: Issue) {
  const list = i.specimens ? [...i.specimens.rising, ...i.specimens.fading, ...i.specimens.seen].filter(s => s.google) : [];
  return [...new Map(list.map(s => [s.family, specimenLink(s.family, s.family)])).values()];
}
