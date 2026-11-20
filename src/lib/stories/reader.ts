// What the Read side may show of the engine's own writing (pure). Reader pages carry facts, not machinery: no deterministic
// so-what templates, no generic advice, no score, and never a Bluesky DID as a byline. The desk and terminal keep everything.

/** Words that open an instruction to the reader ("Audit your…", "Compare…"). */
const IMPERATIVE = /^(audit|review|inspect|analy[sz]e|adopt|compare|evaluate|check|consider|monitor|study|test|update|look|watch|track|use|try|add|replace|plan|brief|decide|benchmark|assess|explore|map|note)\b/i;
/** Generic advice markers: talking to "you", telling someone what they "should" do, or what a change "requires". */
const GENERIC = /\b(audit\w*|you|your|yours|should|requires?|competitors?|consider)\b/i;

/** The AI-written so-what line, only when it is a statement about the story rather than generic advice; when in doubt, null. */
export function readerWhy(line: string | null | undefined): string | null {
  const t = (line ?? "").trim();
  if (!t || IMPERATIVE.test(t) || GENERIC.test(t)) return null;
  return t;
}

const DID = /\s*@?did:[a-z0-9]+:[A-Za-z0-9._:%-]+/g;
/** Strip any Bluesky DID ("Bluesky @did:plc:…" → "Bluesky") so it never reads as a byline. */
export function noDid(text: string): string;
export function noDid(text: string | null): string | null;
export function noDid(text: string | null): string | null {
  if (text == null) return text;
  return text.replace(DID, "").replace(/\s*·\s*(?=·|$)/g, "").replace(/\s{2,}/g, " ").trim();
}
