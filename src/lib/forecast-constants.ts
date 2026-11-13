// One place for trait → corroboration keyword and trait → crawl_spread signal mappings.
export const TRAIT_KEYWORDS: Record<string, string[]> = {
  "theme:dark": ["dark mode", "dark theme"], "headline:serif": ["serif"], "font:webfont": ["web font", "webfont", "variable font"], "font:system": ["system font", "system-ui"],
  "tracking:tight": ["tight tracking", "letter-spacing"], "framework:tailwind": ["tailwind"], "framework:next": ["next.js", "nextjs"], "framework:framer": ["framer"], "framework:webflow": ["webflow"],
  "css:container_queries": ["container quer"], "css:has_selector": [":has("], "css:oklch": ["oklch"], "css:view_transitions": ["view transition"], "css:scroll_timeline": ["scroll-driven", "scroll timeline"], "css:text_wrap_balance": ["text-wrap"], "css:subgrid": ["subgrid"],
  "hero_media:video": ["video hero"], "hero_media:webgl": ["webgl", "three.js"], "imagery:3d_render": ["3d"], "imagery:abstract_gradient": ["gradient"], "components:bento_grid": ["bento"],
  "ai_positioning:ai_core": ["ai-native", "ai native", "agent"], "aesthetic:brutalist": ["brutalis"], "aesthetic:minimal": ["minimal"], "color_mood:monochrome": ["monochrome"],
};
export const TRAIT_SPREAD: Record<string, string> = { "theme:dark": "dark_theme", "headline:serif": "serif_headline", "font:system": "system_font", "framework:tailwind": "tailwind", "tracking:tight": "tight_tracking", "hero_media:video": "video_hero", "hero_media:webgl": "webgl_hero" };
export const TRAIT_GFONT_CATEGORY: Record<string, string> = { "headline:serif": "serif" };
export const NEXT_WAVE_WEIGHTS = { gap: 0.35, vanguard: 0.2, momentum: 0.3, corroboration: 0.15 } as const;
export const HYPE_WORDS = ["revolutionary", "game-changing", "game changing", "groundbreaking", "disruptive", "unprecedented"];
export const EXCLUDED_DIMENSIONS = ["whitespace"]; // median measure, not a share
