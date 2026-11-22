// N2 · the line a page that followed its homepage adds to the brand's own story (quiet.ts followFact writes it), recognised without
// importing the quiet-change module (the writer's check reads it; dependency-free so no import cycle forms). Pure.
/** "The changelog page now uses Systemia too, …" or "The pricing page changed its typeface too, …". */
export const FOLLOW_FACT = /^The (.+?) (?:now uses .+ too|changed its (?:typeface|accent colour|theme) too)\b/;
/** The page a follow line names ("changelog"), or null for any other line. */
export const followPage = (text: string): string | null => { const m = FOLLOW_FACT.exec(text); return m ? m[1]!.replace(/ page$/, "") : null; };
