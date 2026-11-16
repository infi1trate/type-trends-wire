// Readable sentences for library change events, shared by watch pages, the watch feed and audits. Pure; names come from labels.ts.
import { colorName, label } from "../labels";
import { colorTicker } from "../taste/color";

export type EventRow = { id: number; domain: string; type: string; before: unknown; after: unknown; detected_at: string; effective_at?: string | null; source?: string | null; page_type?: string | null; viewport?: string | null; sector?: string | null; summary?: string | null };
export type RebrandRow = { domain: string; sector: string; name: string | null; confirmed_at: string; read: string; reasons: string[]; effective_at?: string | null };

const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const HEX = /^#[\da-f]{6}$/i;
/** "#1C4673" → "Muted dark blue"; unknown input stays as given. */
export const hexName = (hex: unknown) => (typeof hex === "string" && HEX.test(hex) ? colorName(colorTicker(hex)) ?? hex.toUpperCase() : String(hex ?? "none"));
const quote = (t: string, n = 90) => `“${t.length > n ? `${t.slice(0, n - 1)}…` : t}”`;
const list = (xs: string[], n = 4) => (xs.length > n ? `${xs.slice(0, n).join(", ")} and ${xs.length - n} more` : xs.join(", "));
const TECH: Record<string, string> = { next: "Next.js", nuxt: "Nuxt", astro: "Astro", gatsby: "Gatsby", sveltekit: "SvelteKit", framer: "Framer", webflow: "Webflow", wordpress: "WordPress", shopify: "Shopify", squarespace: "Squarespace", wix: "Wix", tailwind: "Tailwind CSS", gsap: "GSAP", lenis: "Lenis", lottie: "Lottie", three: "three.js", webgl_canvas: "a WebGL canvas" };
export const FIELD: Record<string, string> = { h1_align: "headline alignment", hero_media: "hero media", grid_max_cols: "grid columns", cta_radius_px: "button corners", sections: "section count", nav_links: "navigation links", h1: "headline font", body: "body font" };
const words = (v: unknown) => (v == null ? "none" : String(v).replace(/_/g, " "));
const tagNames = (dim: string, v: unknown) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((x): x is string => typeof x === "string").map(x => label(`${dim}:${x}`).name);

/** One plain sentence per event, e.g. "linear.app changed its accent: Muted dark violet → Vivid blue". */
export function eventSentence(e: Pick<EventRow, "domain" | "type" | "before" | "after" | "page_type" | "summary">): string {
  const d = e.domain, b = o(e.before), a = o(e.after);
  switch (e.type) {
    case "palette_shift":
      if ("accent" in a || "accent" in b) return `${d} changed its accent: ${hexName(b["accent"])} → ${hexName(a["accent"])}`;
      return `${d} changed its palette${Array.isArray(a["palette"]) ? ` to ${list((a["palette"] as unknown[]).slice(0, 3).map(hexName))}` : ""}`;
    case "type_change": {
      const parts = (["h1", "body"] as const).filter(k => k in a || k in b).map(k => `${k === "h1" ? "headline" : "body"} ${s(b[k]) ?? "none"} → ${s(a[k]) ?? "none"}`);
      return parts.length === 1 ? `${d} changed its ${parts[0]!.replace(/^(headline|body) /, "$1 font: ")}` : `${d} changed its fonts: ${parts.join("; ") || "type changed"}`;
    }
    case "theme_flip": return `${d} switched to a ${words(a["theme"])} theme (was ${words(b["theme"])})`;
    case "layout_change": {
      const keys = Object.keys({ ...b, ...a });
      return `${d} changed its layout: ${keys.slice(0, 3).map(k => `${FIELD[k] ?? words(k)} ${words(b[k])} → ${words(a[k])}`).join("; ") || "layout changed"}`;
    }
    case "message_pivot": return `${d} changed its headline: ${quote(s(b["headline"]) ?? "none")} → ${quote(s(a["headline"]) ?? "none")}`;
    case "pricing_change": {
      const before = (Array.isArray(b["prices"]) ? b["prices"] : []).map(String), after = (Array.isArray(a["prices"]) ? a["prices"] : []).map(String);
      const added = after.filter(p => !before.includes(p)), removed = before.filter(p => !after.includes(p));
      const bits = [added.length ? `added ${list(added)}` : "", removed.length ? `removed ${list(removed)}` : ""].filter(Boolean);
      return `${d} changed its pricing${bits.length ? `: ${bits.join("; ")}` : ""}`;
    }
    case "redesign": return `${d} redesigned its homepage (${Object.keys(a).length || "several"} measured fields changed at once)`;
    case "stack_change": {
      const k = Object.keys(a)[0] ?? "", name = TECH[k.replace(/^tech\./, "")] ?? words(k.replace(/^tech\./, ""));
      return a[k] === true ? `${d} started using ${name}` : a[k] === false ? `${d} stopped using ${name}` : `${d} changed its stack (${name})`;
    }
    case "new_surface": return `${d} added a${/^[aeiou]/.test(s(a["page_type"]) ?? e.page_type ?? "") ? "n" : ""} ${words(s(a["page_type"]) ?? e.page_type ?? "new")} page`;
    case "nav_change": return `${d} changed its navigation`;
    case "imagery_shift": case "aesthetic_shift": {
      const dim = e.type === "imagery_shift" ? "imagery" : "aesthetic";
      return `${d} shifted its ${dim} (AI estimate): ${list(tagNames(dim, b[dim])) || "none"} → ${list(tagNames(dim, a[dim])) || "none"}`;
    }
    default: return `${d} changed${e.summary ? `: ${e.summary}` : ""}`;
  }
}

/** Short kind word for receipts lines. */
export const EVENT_KIND: Record<string, string> = { type_change: "Type", palette_shift: "Color", theme_flip: "Theme", layout_change: "Layout", redesign: "Redesign", message_pivot: "Copy", pricing_change: "Pricing", new_surface: "New page", stack_change: "Stack", nav_change: "Navigation", imagery_shift: "Imagery (AI)", aesthetic_shift: "Aesthetic (AI)" };
export const eventDetail = (e: Pick<EventRow, "type" | "page_type" | "viewport">) => [EVENT_KIND[e.type] ?? words(e.type), e.page_type ? `${e.page_type} page` : null, e.viewport].filter(Boolean).join(" · ");

export const REBRAND_WORDS: Record<string, string> = { font: "font", accent: "accent", palette: "palette", theme: "theme", redesign: "redesign" };
export const rebrandSentence = (r: Pick<RebrandRow, "domain" | "reasons">) => `${r.domain} confirmed a rebrand (${r.reasons.map(x => REBRAND_WORDS[x] ?? x).join(", ") || "identity change"})`;
