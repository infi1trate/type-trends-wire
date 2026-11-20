// Leading indicators (W2): which outside-numbers table a signal page points to. One small editable map: a signal key (as on
// /signals/<key>) → the topic table on /signals/leading. A signal not listed here shows no "Related outside numbers" line.
// Topics are the crawler's library topics; their order and display names live here too.

/** The page's tables, in reading order. */
export const TOPIC_ORDER = ["type", "styling", "components", "motion", "3d", "icons", "charts", "carousels", "tokens"] as const;
export type KnownTopic = (typeof TOPIC_ORDER)[number];
export const TOPIC_NAME: Record<KnownTopic, string> = {
  type: "Type", styling: "Styling", components: "Components", motion: "Motion", "3d": "3D",
  icons: "Icons", charts: "Charts", carousels: "Carousels", tokens: "Design tokens",
};
/** A topic's display name; a topic the page does not know yet reads as its own word. */
export const topicName = (t: string): string => (TOPIC_NAME as Record<string, string>)[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
/** The anchor of a topic's table on /signals/leading. */
export const topicAnchor = (t: string): string => `lead-${t.replace(/[^a-z0-9-]/g, "-")}`;
export const LEADING_PATH = "/signals/leading";
export const topicHref = (t: string): string => `${LEADING_PATH}#${topicAnchor(t)}`;

/** Signal key → topic table. Edit freely: a signal belongs to at most one table. */
export const SIGNAL_TOPIC: Readonly<Record<string, KnownTopic>> = {
  // Type: how headlines and text are set.
  "font:webfont": "type", "font:system": "type", "headline:serif": "type", "tracking:tight": "type",
  "css:variable_fonts": "type", "css:text_wrap_balance": "type", "combo:big_type": "type", "combo:editorial_serif": "type",
  // Styling: utility CSS and modern CSS features.
  "framework:tailwind": "styling", "css:container_queries": "styling", "css:has_selector": "styling", "css:nesting": "styling",
  "css:cascade_layers": "styling", "css:color_mix": "styling", "css:oklch": "styling", "css:subgrid": "styling", "css:clamp": "styling",
  "css:anchor_positioning": "styling", "css:backdrop_filter": "styling", "css:dvh_units": "styling",
  // Components: interface building blocks.
  "components:faq_accordion": "components", "components:feature_tabs": "components", "components:interactive_demo": "components", "combo:soft_ui": "components",
  // Motion: scroll and transition effects.
  "css:scroll_timeline": "motion", "css:view_transitions": "motion", "css:starting_style": "motion", "combo:motion_rich": "motion",
  "components:sticky_scroll_story": "motion", "components:marquee": "motion",
  // 3D: rendered and real-time 3D.
  "imagery:3d_render": "3d", "hero_media:webgl": "3d", "combo:immersive_3d": "3d",
  // Charts, carousels, tokens.
  "imagery:data_viz": "charts",
  "components:carousel": "carousels",
  "css:custom_properties": "tokens",
};
/** The topic table a signal links to, or null. */
export const topicOfSignal = (key: string): KnownTopic | null => SIGNAL_TOPIC[key] ?? null;
