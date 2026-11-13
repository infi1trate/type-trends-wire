import { z } from "zod";
import { libraryDomain } from "./library-payload";
import { reliableVision } from "./ai-vision";
export const VOCAB = {
 imagery: ["product_ui","photography_people","photography_product","photography_lifestyle","3d_render","illustration_flat","illustration_hand_drawn","abstract_gradient","abstract_shapes","generative_art","data_viz","video_still","typographic_only","collage","pixel_art","none"],
 aesthetic: ["minimal","swiss_grid","editorial","brutalist","neo_brutalist","glassmorphism","dark_tech","retro_futurist","y2k","skeuomorphic","playful","luxury","corporate","maximalist","organic","terminal_mono"],
 components: ["bento_grid","logo_wall","testimonial_cards","testimonial_quote","stats_row","feature_grid","feature_tabs","alternating_feature_rows","marquee","pricing_table","faq_accordion","code_block","chat_ui_mock","product_screenshot","device_mockup","video_embed","cta_band","newsletter_signup","comparison_table","case_study_cards","team_grid","map","carousel","sticky_scroll_story","interactive_demo","cookie_banner"],
 hero_layout: ["centered_stack","split_left_text","split_right_text","full_bleed_media","text_only","grid_collage","product_first"],
 ai_positioning: ["ai_core","ai_feature","ai_mentioned","none"], tone: ["technical","aspirational","playful","premium","friendly","authoritative","irreverent","calm","urgent"],
 color_mood: ["monochrome","muted","pastel","vivid","neon","earthy","high_contrast"],
} as const;
export const visionOutputSchema = z.object({ imagery: z.array(z.enum(VOCAB.imagery)).max(3), aesthetic: z.array(z.enum(VOCAB.aesthetic)).max(2), components: z.array(z.enum(VOCAB.components)).max(26), hero_layout: z.enum(VOCAB.hero_layout).nullable(), ai_positioning: z.enum(VOCAB.ai_positioning).nullable(), tone: z.array(z.enum(VOCAB.tone)).max(3), color_mood: z.enum(VOCAB.color_mood).nullable(), confidence: z.number().min(0).max(1), blocked_reason:z.enum(['blank','captcha','cookie_wall','login_wall','error_page']).nullable().default(null) }).strict();
export const tagsSchema = visionOutputSchema.extend({low_confidence:z.boolean().optional()}).strict();
export function cleanTags(value: unknown) {
 const raw = z.record(z.string(), z.unknown()).parse(value), cleaned = { ...raw };
 for (const key of ["imagery","aesthetic","components","tone"] as const) {
  const allowed: readonly string[] = VOCAB[key];
  cleaned[key] = Array.isArray(raw[key]) ? [...new Set(raw[key].filter((v): v is string => typeof v === "string" && allowed.includes(v)))].slice(0,key==="imagery"||key==="tone"?3:key==="aesthetic"?2:26) : [];
 }
 const tags=tagsSchema.parse(cleaned);
 if(tags.blocked_reason) return {...tags,imagery:[],aesthetic:[],components:[],tone:[],hero_layout:null,ai_positioning:null,color_mood:null,confidence:Math.min(tags.confidence,0.2),low_confidence:true};
 return {...tags,low_confidence:!reliableVision(tags)};
}
const short = z.string().max(120), nullablePrice = z.number().nonnegative().nullable();
export const pricingSchema = z.object({ currency: z.string().max(12).nullable(), plans: z.array(z.object({ name: z.string().min(1).max(80), price_monthly: nullablePrice, price_basis: z.enum(["flat","per_seat","usage","custom"]), billing: z.enum(["monthly","annual","both","unknown"]), is_free: z.boolean(), is_enterprise_contact: z.boolean(), highlighted: z.boolean(), ai_addon: z.boolean(), key_limits: z.array(short).max(3) }).strict()).max(30), has_free_tier: z.boolean(), has_trial: z.boolean(), trial_days: z.number().int().nonnegative().max(365).nullable(), has_usage_based: z.boolean(), has_ai_addon: z.boolean(), ai_credits_model: z.boolean(), cheapest_paid_monthly: nullablePrice }).strict();
export const CHANGE_CATEGORIES = ["feature","ai","integration","performance","fix","design","pricing","platform","security","other"] as const;
const date = z.iso.date().nullable();
export const changelogSchema = z.object({ entries: z.array(z.object({ date, title: short, category: z.enum(CHANGE_CATEGORIES) }).strict()).max(15), latest_date: date, entries_last_30d: z.number().int().nonnegative().max(15), ai_share: z.number().min(0).max(1) }).strict();
export const FEATURE_THEMES = ["ai_assistant","ai_agents","ai_generation","search","collaboration","realtime","analytics","automation","integrations","api_dev","security_compliance","payments","mobile","offline","templates","customization","workflow","data_import_export","notifications","accessibility","other"] as const;
export const productSchema = z.object({ features: z.array(z.object({ name: z.string().min(1).max(60), theme: z.enum(FEATURE_THEMES) }).strict()).max(20), primary_theme: z.enum(FEATURE_THEMES), mentions_agents: z.boolean(), mentions_mcp: z.boolean() }).strict();
export const extractionSchemas = { pricing: pricingSchema, changelog: changelogSchema, product: productSchema };
export type ExtractionKind = keyof typeof extractionSchemas;
const CURRENCY_ALIASES: Record<string,string> = { "$":"USD", "US$":"USD", "USD":"USD", "€":"EUR", "EUR":"EUR", "£":"GBP", "GBP":"GBP", "¥":"JPY" };
export function normalizeCurrency(value: string | null | undefined): string | null {
 const v = (value ?? "").trim().toUpperCase();
 return CURRENCY_ALIASES[v] ?? (/^[A-Z]{3}$/.test(v) ? v : null);
}
export function normalizeExtraction(kind: ExtractionKind, value: unknown, capturedAt: string) {
 if (kind === "pricing") {
  const p = pricingSchema.parse(value), paid = p.plans.filter(p => !p.is_free && !p.is_enterprise_contact && p.price_monthly !== null && p.price_monthly > 0).map(p => p.price_monthly ?? 0);
  return { ...p, currency: normalizeCurrency(p.currency), has_free_tier: p.plans.some(p => p.is_free), has_usage_based: p.plans.some(p => p.price_basis === "usage"), has_ai_addon: p.plans.some(p => p.ai_addon), cheapest_paid_monthly: paid.length ? Math.min(...paid) : null };
 }
 if (kind === "changelog") {
  const c = changelogSchema.parse(value), time = Date.parse(capturedAt), entries = [...c.entries].sort((a,b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { ...c, entries, latest_date: entries.find(e => e.date)?.date ?? null, entries_last_30d: entries.filter(e => e.date && Date.parse(e.date) <= time && Date.parse(e.date) >= time - 30 * 86400000).length, ai_share: entries.length ? entries.filter(e => e.category === "ai").length / entries.length : 0 };
 }
 return productSchema.parse(value);
}
const jpeg = z.string().max(2796204).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).refine(v => { try { const bytes = atob(v.slice(v.indexOf(",")+1)); return bytes.startsWith("\xff\xd8\xff") && bytes.endsWith("\xff\xd9"); } catch { return false; } },"Valid JPEG required");
const sectionJpeg = jpeg.refine(v => {try{return atob(v.slice(v.indexOf(",")+1)).length <= 600 * 1024;}catch{return false;}}, "Section JPEG must be at most 600 KB decoded");
export const tagRequestSchema = z.object({ domain: libraryDomain, source: z.enum(["live","wayback"]).default("live"), page_type: z.literal("home"), viewport: z.literal("desktop"), captured_at: z.iso.datetime({ offset: true }), signals_hash: z.string().min(1).max(256), images: z.object({ fold: jpeg, page: jpeg.optional(), sections: z.array(sectionJpeg).max(4).optional() }).strict() }).strict();
export function reusableTags(row: { domain: string; signals_hash: string; created_at: string; tags: unknown }, domain: string, hash: string, now = new Date()) {
 const parsed=tagsSchema.safeParse(row.tags);
 return row.domain === domain && row.signals_hash === hash && Date.parse(row.created_at) <= now.getTime() && Date.parse(row.created_at) > now.getTime() - 60 * 86400000 && parsed.success && reliableVision(parsed.data);
}