// Latest icon, social card and hero crop per brand (the public brand_pictures view: one indexed read, opted-out brands hidden by
// policy). Anonymous SELECT-only, memoised briefly per instance so new pictures show within a couple of minutes. Never throws:
// a page without its pictures still renders as it does today.
import { supabaseAnon } from "./mcp/supabase";
import { memo } from "./memo";
import { NO_PICS, pictureIndex, type BrandPics, type PictureRow } from "./pictures";

export const pictures = memo(2 * 60_000, async (): Promise<Map<string, BrandPics>> => {
  const out: PictureRow[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabaseAnon().from("brand_pictures").select("domain,kind,path,width,height,captured_at").order("domain").order("kind").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as PictureRow[]));
    if (!data || data.length < 1000) break;
  }
  return pictureIndex(out);
});
/** The index, or an empty one when the read fails. */
export const picturesSafe = () => pictures().catch(() => new Map<string, BrandPics>());
/** One brand's pictures: from the index when this instance holds it, else C1 · one indexed read of that brand's rows only (a cold
 *  server's brand page waited on the whole index, every brand's rows in pages of 1000, before its card could be sent). */
export const picsFor = async (domain: string): Promise<BrandPics> => {
  const all = pictures.peek();
  if (all) return all.get(domain) ?? NO_PICS;
  try {
    const { data, error } = await supabaseAnon().from("brand_pictures").select("domain,kind,path,width,height,captured_at").eq("domain", domain).order("kind").limit(1000);
    if (error) throw error;
    return pictureIndex((data ?? []) as PictureRow[]).get(domain) ?? NO_PICS;
  } catch { return NO_PICS; }
};
