// The golden set's skipped calls and why (pure; read by golden.test.ts, the desk and the newsroom memory).
/** E2a's 36 calls plus the Netlify case added in E2e: 37 cases in the four call groups. */
export const GOLDEN_CASES = 37;
export const SKIPPED: Record<string, string> = {
  "9 · one story from the two AI stage notices":
    "Both stage notices come from comparing forecast runs 9 (14 Nov) and 13 (15 Nov), 39 hours apart. The standing rule compares only real runs at least six days apart, so no shift exists in this data; the engine does merge AI-positioning stage changes from one valid run pair into one story (editor.test.ts).",
  "10 · studios and Swiss-grid layouts as a crossover or breakout":
    "The crossover came from the same 39-hour run pair (retired by the six-day rule) and no breakout alert fired for Swiss grid, so the forecast data holds neither. The AI-read Swiss-grid roundup exists but is neither type.",
};
