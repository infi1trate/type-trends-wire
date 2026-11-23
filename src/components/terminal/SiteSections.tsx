import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { siteCropsQuery } from "@/lib/data";
import { CROP_SECTIONS, latestSections, type CropRow } from "@/lib/crops";
import { CROP_SECTION_NAME } from "@/lib/labels";
/** Compact SECTIONS row on the brand record: each captured section links to its history on the brand page. Honest when empty. */
export function SiteSections({ domain }: { domain: string }) {
  // C1 · waits for the crops (they come with the record), so the row never grows after the page is drawn; a failed read is `null`.
  const { data } = useSuspenseQuery(siteCropsQuery(domain)), isError = data === null;
  const latest = data ? latestSections(data as CropRow[], domain) : [];
  const byKey = new Map(latest.map(c => [c.section, c]));
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-3 py-2">
    <span className="label text-compare-muted">SECTIONS</span>
    {isError ? <span className="label text-compare-muted">COULDN'T READ CROPS</span>
      : !latest.length ? <span className="label text-compare-muted">NO SECTION CAPTURES YET</span>
      : CROP_SECTIONS.map(s => { const c = byKey.get(s); return c
        ? <Link key={s} to="/brands/$domain" params={{ domain }} search={{ section: s }} hash="ed-sections" className="label inline-flex items-center hover:text-highlight max-md:h-11">{CROP_SECTION_NAME[s].toUpperCase()} <span className="num ml-1 text-compare-muted">{c.captured_at.slice(0, 10)} · {c.versions}V</span></Link>
        : <span key={s} className="label text-compare-muted">{CROP_SECTION_NAME[s].toUpperCase()} —</span>; })}
  </div>;
}
