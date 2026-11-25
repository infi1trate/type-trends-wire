// The request path reads stored rows only. Trait membership and first dates are built in the weekly library step.
import { supabaseAnon } from "./mcp/supabase";
import type { KitRecord } from "./designer-kit";
export async function loadKitRecords(): Promise<KitRecord[]> {
  const rows: KitRecord[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const r = await supabaseAnon().from("brand_kit_records").select("payload").order("domain").range(from, from + 999);
    if (r.error) throw new Error("designer_kit_read_failed");
    rows.push(...(r.data ?? []).map(r => r.payload as unknown as KitRecord));
    if ((r.data ?? []).length < 1000) break;
  }
  return rows;
}
export async function loadReferenceKit() {
  const [rows, { picturesSafe }, { iconsFor }] = await Promise.all([loadKitRecords(), import("./pictures.server"), import("./pictures")]);
  const pics = await picturesSafe();
  // Crop policies and the serving route enforce opt-out; never store pictures in the kit.
  const crops: import("./crops").CropRow[] = [];
  const db = supabaseAnon();
  for (let from = 0; from < 10000; from += 1000) {
    const r = await db.from("site_crops").select("domain,section,viewport,captured_at,first_seen_at,last_seen_at,path,width,height,bytes,hash").eq("viewport", "desktop").order("id").range(from, from + 999);
    if (r.error) throw new Error("reference_crops_read_failed");
    crops.push(...r.data as import("./crops").CropRow[]);
    if (r.data.length < 1000) break;
  }
  // Only crops of brands on the boards: the table also holds crops of brands still onboarding or no longer tracked, and
  // everything returned here is sent to the reader's browser with the page.
  const inKit = new Set(rows.map(r => r.domain));
  return { rows, crops: crops.filter(c => inKit.has(c.domain)), icons: iconsFor(pics, rows.map(r => r.domain)) };
}