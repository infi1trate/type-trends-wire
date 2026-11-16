// Server side of data stories: builds each model from cached stored data and caches the result. No writes, no AI.
import { dataInput, capturesFor, capturesOf } from "./data.server";
import { BUILDERS, buildStory, buildWhereYouSit, indexRows, isTracked, normDomain, liveNow } from "./build";
import { entryOf, templateName } from "./registry";
import type { StoryModel } from "./types";
import { memoBy } from "../memo";

const TTL = 10 * 60_000;
const built = memoBy(TTL, (job: { k: string; f: () => Promise<StoryModel | null> }) => job.f(), { key: j => j.k, max: 80 });
const memo = (k: string, f: () => Promise<StoryModel | null>) => built({ k, f });
const through = (i: Awaited<ReturnType<typeof dataInput>>) => i.captures.reduce<string | null>((m, c) => (!m || c.at > m ? c.at : m), null);

export async function loadDataIndex() {
  const i = await dataInput().catch(() => null);
  return { rows: indexRows(i, i ? through(i) : null) };
}
export type DataStoryPage = { kind: "live"; story: StoryModel } | { kind: "draft"; number: number; question: string; deck: string; template: string; reason: string | null } | { kind: "missing" };
export async function loadDataStory(slug: string): Promise<DataStoryPage> {
  const e = entryOf(slug);
  if (!e) return { kind: "missing" };
  const i = await dataInput();
  const story = await memo(`s:${slug}`, async () => { const b = BUILDERS[slug]; if (!b) return null; return buildStory(slug, i, await capturesFor(b.domains(i))); });
  if (story) return { kind: "live", story };
  const { statusOf } = await import("./build");
  return { kind: "draft", number: e.number, question: e.question, deck: e.deck, template: templateName(e), reason: statusOf(e, i).reason };
}
/** Every tracked brand for the picker (the only brands a reader can choose). */
export async function loadTrackedBrands() {
  const i = await dataInput();
  return i.sites.filter(s => s.active).map(s => ({ domain: s.domain, name: s.name ?? s.domain, sector: s.sector })).sort((a, b) => a.name.localeCompare(b.name));
}
export async function loadWhereYouSit(raw: string): Promise<{ kind: "story"; story: StoryModel } | { kind: "untracked"; domain: string } | { kind: "none" }> {
  const domain = normDomain(raw);
  if (!domain) return { kind: "none" };
  const i = await dataInput();
  if (!isTracked(i, domain)) return { kind: "untracked", domain };
  const story = await memo(`w:${domain}`, async () => buildWhereYouSit(i, domain, await capturesOf(domain)));
  return story ? { kind: "story", story } : { kind: "untracked", domain };
}
/** Live stories for the front page shelf (empty when none). */
export async function loadDataShelf() {
  const i = await dataInput().catch(() => null);
  return i ? liveNow(i).map(e => ({ slug: e.slug, number: e.number, question: e.question, href: `/data/${e.slug}` })) : [];
}
