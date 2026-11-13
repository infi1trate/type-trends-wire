import { z } from "zod";
import { librarySector } from "./library-payload";
export const HISTORY_METRICS = ["dark_theme_share","serif_h1_share","webfont_share","system_ui_body_share","median_whitespace","median_h1_px","tight_tracking_share","pill_cta_share","webgl_hero_share","video_hero_share","tailwind_share","framer_share","webflow_share","next_share"] as const;
export const historyInput = z.object({metric:z.enum(HISTORY_METRICS).optional(),dimension:z.enum(["css","fonts","imagery","aesthetic","components","hero_layout","ai_positioning","tone","color_mood"]).optional(),value:z.string().min(1).max(200).optional(),sector:z.union([librarySector,z.literal("all")]).optional()}).strict();
export function halfYear(value: string): string {
 const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error("Invalid capture timestamp");
 return `${date.getUTCFullYear()}-${date.getUTCMonth()<6?"01":"07"}-01`;
}
export type HistoryPoint = {bucket:string;value:number|null;coverage:number;sector:string};
export function archiveVersions<T extends {source:string;page_type:string;viewport:string;captured_at:string}>(rows:T[]):T[] {
 const buckets=new Map<string,T>();
 for(const row of [...rows].sort((a,b)=>a.captured_at.localeCompare(b.captured_at)))if(row.source==="wayback"&&row.page_type==="home"&&row.viewport==="desktop")buckets.set(halfYear(row.captured_at),row);
 return [...buckets.values()];
}