// Turns the raw rendered font names from Chromium into stable family names.
// Linux runners lack Arial/Helvetica/SF, so Chromium substitutes Liberation/DejaVu/Noto: when that happens
// we report the first family the CSS actually asked for and flag it as a system font.
const FALLBACK = /^(Liberation (Sans|Serif|Mono)|DejaVu (Sans|Serif)( Mono)?|FreeSans|FreeSerif|FreeMono|Noto (Sans|Serif)( [A-Z][\w ]*)?|WenQuanYi.*|Loma|Garuda|Kinnari|Norasi|Umpush|Waree|Tlwg.*|Lohit.*|Droid Sans.*|Nimbus.*|URW.*|C059|P052|Z003)$/i;
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|emoji|math|fangsong|-apple-system|BlinkMacSystemFont)$/i;
const SYSTEM_STACK = /^(-apple-system|BlinkMacSystemFont|system-ui|ui-sans-serif|Segoe UI|Roboto|Helvetica Neue|Helvetica|Arial|San Francisco|SF Pro( Display| Text)?)$/i;
const SUFFIX = /[\s-]+(Variable|VF|Var|Thin|Hairline|Extra ?Light|Ultra ?Light|Light|Regular|Normal|Book|Medium|Semi ?Bold|Demi ?Bold|Bold|Extra ?Bold|Ultra ?Bold|Black|Heavy|Italic|Oblique|\d+\s?pt|Web|Pro Web|Web ?Font|WF|Font|Sans Font)$/i;

export function normalizeFamily(name) {
  if (!name) return null;
  let n = String(name).replace(/\[.*?\]/g, "").replace(/["']/g, "").trim();
  // next/font self-hosted names: "__styreneA_403256", "__Inter_Fallback_aaf875" → "styreneA" / "Inter"
  const nf = /^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$/i.exec(n);
  if (nf) n = nf[1];
  if (!n || /[^\x20-\x7EÀ-ɏ]/.test(n) && !/[぀-ヿ一-鿿가-힯؀-ۿ]/.test(n)) return "(obfuscated)";
  if (!/[A-Za-zÀ-ɏ぀-ヿ一-鿿가-힯؀-ۿ]/.test(n)) return "(obfuscated)"; // ".", "_", digits only
  for (let i = 0; i < 4; i++) { const m = n.replace(SUFFIX, "").trim(); if (m === n || !m) break; n = m; }
  // CSS-style identifiers to display names: "basier-square" → "Basier Square", "abcNormal" → "ABC Normal".
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(n)) n = n.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  else if (/^[A-Za-z0-9]+(-[A-Za-z0-9]+)+$/.test(n)) n = n.replace(/-/g, " ");
  else if (/^[a-z]+[A-Z]/.test(n) && !/\s/.test(n)) n = n.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  return n.replace(/^Abc\b/, "ABC").replace(/^Pp\b/, "PP").replace(/^Tt\b/, "TT").replace(/^Gt\b/, "GT").replace(/^Sf\b/, "SF");
}

export function firstDeclared(stack) {
  if (!stack) return null;
  for (const part of stack.split(",")) {
    const f = part.trim().replace(/^["']|["']$/g, "");
    if (f && !GENERIC.test(f)) return f;
  }
  return null;
}

// A stack that opens with the OS UI font means "use the system font", whatever Linux substituted.
const SYSTEM_FIRST = /^\s*["']?(-apple-system|BlinkMacSystemFont|system-ui|ui-sans-serif)["']?\s*(,|$)/i;

export function resolveFonts(rendered, declared) {
  const declaredFor = { h1: declared.h1, body: declared.body, cta: declared.cta, h2: null, nav: declared.body };
  const out = {};
  for (const [role, r] of Object.entries(rendered)) {
    // A downloaded webfont is what the designer chose, whatever its name; only local system faces can be substitutes.
    const junkName = /copyright|licen[cs]e|©|trademark/i.test(r.raw) || normalizeFamily(r.raw) === "(obfuscated)";
    const isFallback = (!r.webfont && FALLBACK.test(r.raw)) || junkName;
    let family = normalizeFamily(r.raw);
    let system = false;
    if (isFallback && SYSTEM_FIRST.test(declaredFor[role]?.stack ?? "")) {
      family = "System UI"; system = true;
    } else if (isFallback) {
      const asked = firstDeclared(declaredFor[role]?.stack);
      family = asked ? normalizeFamily(asked) : family;
      system = !junkName && (!asked || SYSTEM_STACK.test(asked));
    }
    out[role] = { family, raw: r.raw, webfont: !!r.webfont, substituted: isFallback, system, glyphs: r.glyphs, also: r.also };
  }
  return out;
}
