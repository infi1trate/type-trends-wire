// W3d · the icon study's one read: the newest stored week's rows that are not removed (service role; app_icons has no reader policy).
// Rows carry measured colours, name, maker and App Store link only.
import type { IconIn } from "./measure";

const COLS = "app_id,rank,name,maker,link,palette,genre_id,genre_name,week";
export async function newestIconWeek(): Promise<IconIn[]> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const top = await db.from("app_icons").select("week").is("removed_at", null).order("week", { ascending: false }).limit(1);
  if (top.error) throw new Error("Icon read failed");
  const week = top.data?.[0]?.week;
  if (!week) return [];
  const out: IconIn[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const r = await db.from("app_icons").select(COLS).eq("week", week).is("removed_at", null).order("id").range(from, from + 999);
    if (r.error) throw new Error("Icon read failed");
    out.push(...((r.data ?? []) as unknown as IconIn[]));
    if ((r.data?.length ?? 0) < 1000) break;
  }
  return out;
}
