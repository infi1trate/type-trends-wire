// Runs INSIDE the page (page.evaluate). Plain browser JS, no imports.
// Library-only extras: nav taxonomy, DOM skeleton boxes for wireframe redraw, modern CSS features,
// candidate links for page discovery, and visible text for hashing / later extraction.
export function extractLibraryExtras() {
  const VW = window.innerWidth;
  const root = document.body || document.documentElement;
  const cs = (el) => getComputedStyle(el);
  const sx = window.scrollX, sy = window.scrollY;
  const clean = (t, max = 80) => (t || "").replace(/\s+/g, " ").trim().slice(0, max);
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = cs(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };

  // ---- nav taxonomy: top-level links in the header/nav, plus nested (menu) links at depth 2 ----
  const header = [...document.querySelectorAll("header, nav, [role=banner], [role=navigation]")].find((e) => e.getBoundingClientRect().top < 200);
  const nav = [];
  if (header) {
    for (const a of header.querySelectorAll("a[href]")) {
      const label = clean(a.innerText || a.getAttribute("aria-label"), 40);
      if (!label) continue;
      const depth = a.closest("ul ul, [role=menu], [class*=dropdown], [class*=submenu], [class*=mega]") ? 2 : 1;
      nav.push({ label, href: a.href.slice(0, 300), depth, visible: shown(a) });
      if (nav.length >= 60) break;
    }
  }

  // ---- skeleton: leaf-ish visible boxes, page coordinates ----
  const kindOf = (el) => {
    const t = el.tagName;
    if (/^(IMG|PICTURE|VIDEO|CANVAS|IFRAME|SVG)$/i.test(t)) return t === "VIDEO" || t === "IFRAME" ? "video" : t === "CANVAS" ? "canvas" : "media";
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t)) return "control";
    if (t === "A" && cs(el).backgroundColor !== "rgba(0, 0, 0, 0)") return "control";
    if (/^H[1-3]$/.test(t)) return "heading";
    if (/^(P|LI|SPAN|A|H4|H5|H6|BLOCKQUOTE|LABEL|SMALL|STRONG|EM)$/.test(t)) return "text";
    const bg = cs(el).backgroundImage;
    if (bg && bg !== "none" && /url\(/.test(bg)) return "media";
    return null;
  };
  const boxes = [];
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let n = 0;
  while (walker.nextNode() && n++ < 8000 && boxes.length < 400) {
    const el = walker.currentNode;
    const kind = kindOf(el);
    if (!kind || !shown(el)) continue;
    if (kind === "text" && el.closest("button, a[class*=btn], a[class*=button]")) continue;
    if (kind === "text" && !(el.innerText || "").trim()) continue;
    // Skip a text node whose nearest kept ancestor is already a text/heading box.
    let p = el.parentElement, nested = false;
    while (p && p !== root) { if (seen.has(p)) { nested = true; break; } p = p.parentElement; }
    if (nested) continue;
    const r = el.getBoundingClientRect();
    seen.add(el);
    boxes.push({ x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height), kind });
  }
  // Section bands: direct children of main/body that are tall.
  for (const s of document.querySelectorAll("main > *, body > section, body > div > section, main > div > section")) {
    if (boxes.length >= 400) break;
    const r = s.getBoundingClientRect();
    if (r.height > 200 && r.width > VW * 0.6) boxes.push({ x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height), kind: "section" });
  }

  // ---- modern CSS features in readable stylesheets + inline styles ----
  let css = "";
  for (const sh of document.styleSheets) {
    try { for (const r of sh.cssRules) { css += r.cssText + "\n"; if (css.length > 600000) break; } } catch { /* cross-origin */ }
    if (css.length > 600000) break;
  }
  for (const s of document.querySelectorAll("style")) css += s.textContent;
  const F = {
    container_queries: /@container\b|container-type\s*:/,
    has_selector: /:has\(/,
    subgrid: /subgrid/,
    view_transitions: /view-transition|::view-transition/,
    scroll_timeline: /animation-timeline\s*:|scroll-timeline|view-timeline/,
    color_mix: /color-mix\(/,
    oklch: /oklch\(|oklab\(/,
    cascade_layers: /@layer\b/,
    nesting: /&\s*[:.\[#>~+a-z]/i,
    text_wrap_balance: /text-wrap\s*:\s*(balance|pretty)/,
    clamp: /clamp\(/,
    dvh_units: /\d(dvh|svh|lvh)\b/,
    backdrop_filter: /backdrop-filter\s*:/,
    variable_fonts: /font-variation-settings|font-weight\s*:\s*\d+\s+\d+/,
    custom_properties: /--[\w-]+\s*:/,
    starting_style: /@starting-style/,
    anchor_positioning: /anchor-name|position-anchor/,
  };
  const css_features = Object.entries(F).filter(([, re]) => re.test(css)).map(([k]) => k);

  // ---- candidate links for page discovery ----
  const host = location.hostname.replace(/^www\./, "");
  const links = [];
  for (const a of document.querySelectorAll("a[href]")) {
    let u; try { u = new URL(a.href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const h = u.hostname.replace(/^www\./, "");
    if (h !== host && !h.endsWith("." + host)) continue;
    links.push({ href: (u.origin + u.pathname).slice(0, 300), text: clean(a.innerText || a.getAttribute("aria-label"), 40), in_nav: !!(header && header.contains(a)) });
    if (links.length >= 400) break;
  }

  const text = (root.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 50000);
  return { nav, skeleton: boxes, css_features, links, text, page_w: VW, page_h: document.documentElement.scrollHeight };
}
