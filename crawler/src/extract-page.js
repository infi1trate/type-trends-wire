// Runs INSIDE the page (page.evaluate). Plain browser JS, no imports.
// Returns layout, composition, lexicon, tech and declared-style signals for the first viewport.
export function extractInPage() {
  const VW = window.innerWidth, VH = window.innerHeight;
  const cs = (el) => getComputedStyle(el);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = cs(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const inFold = (el) => { const r = el.getBoundingClientRect(); return r.top < VH && r.bottom > 0 && r.left < VW && r.right > 0; };
  const foldArea = (el) => {
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, VW) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, VH) - Math.max(r.top, 0));
    return (w * h) / (VW * VH);
  };
  const clean = (t, max = 160) => (t || "").replace(/\s+/g, " ").trim().slice(0, max);
  const px = (v) => parseFloat(v) || 0;

  // ---- type (declared) ----
  const typeOf = (el) => {
    if (!el) return null;
    const s = cs(el);
    return {
      stack: s.fontFamily, size_px: px(s.fontSize), weight: Number(s.fontWeight) || 400,
      letter_spacing_em: s.letterSpacing === "normal" ? 0 : +(px(s.letterSpacing) / px(s.fontSize)).toFixed(3),
      line_height: s.lineHeight === "normal" ? null : +(px(s.lineHeight) / px(s.fontSize)).toFixed(2),
      transform: s.textTransform, style: s.fontStyle,
    };
  };
  // Overlays (cookie/consent dialogs, modals) are not the page's design.
  const OVERLAY = "[role=dialog], [aria-modal=true], [id*=cookie i], [class*=cookie i], [id*=consent i], [class*=consent i], [id*=onetrust i], [id*=gdpr i], [class*=gdpr i]";
  const inOverlay = (e) => !!e.closest(OVERLAY);
  // Headline = first visible h1 in the fold; many sites have none, so fall back to the largest text in the fold.
  let h1 = [...document.querySelectorAll("h1")].find((e) => visible(e) && inFold(e) && !inOverlay(e)) || null;
  let headline_source = h1 ? "h1" : null;
  if (!h1) {
    let best = null, bestSize = 0;
    // Controls and navigation are not headlines: a consent button ("acknowledged") or a top-bar link once stood in for one.
    const CONTROL = "a, button, [role=button], [role=link], [role=tab], [role=menuitem], nav, [role=navigation], label, input, select, summary";
    const DISMISS = /^(accept(ed)?( all)?|acknowledged?|agree(d)?|i agree|got it|ok(ay)?|dismiss|close|allow( all)?|decline|reject( all)?|skip|continue|no,? thanks)\b[.! ]*$/i;
    for (const e of document.querySelectorAll("body h2, body h3, body p, body div, body span")) {
      if (e.children.length > 2 || !visible(e) || !inFold(e) || inOverlay(e) || e.closest(CONTROL)) continue;
      const t = (e.innerText || "").trim();
      if (t.length < 3 || t.length > 140 || DISMISS.test(t)) continue;
      const sz = px(cs(e).fontSize);
      if (sz > bestSize) { best = e; bestSize = sz; }
    }
    if (best && bestSize >= 24) { h1 = best; headline_source = "largest_text"; }
  }
  if (h1) h1.setAttribute("data-dsgn-headline", "1");
  // A rotating hero: the headline sits inside a carousel, or the fold holds slide controls. Its headline and hero media are one slide
  // of several, so the site treats their changes as rotations, not moves.
  const CAROUSEL = "[aria-roledescription=carousel i], [aria-roledescription=slide i], [class*=carousel i], [class*=swiper i], [class*=slick-slide i], [class*=slick-slider i], [class*=splide i], [class*=embla i], [class*=flickity i], [data-carousel], [data-slick]";
  const SLIDE_CONTROL = /\b(next|previous|prev)\s+(slide|item)\b|\bgo to slide\b|\bslide\s+\d+\b/i;
  // A slide counter in the fold ("05/12", "3 / 8") marks a rotating showcase even when nothing is labelled as a carousel.
  const SLIDE_COUNTER = /^0?\d{1,2}\s*\/\s*0?\d{1,2}$/;
  const slideCounter = [...document.querySelectorAll("body span, body div, body p, body li, body button")].some((e) => {
    if (e.children.length > 3) return false;
    const m = (e.textContent || "").trim().match(SLIDE_COUNTER);
    if (!m) return false;
    const [a, b] = m[0].split("/").map((x) => parseInt(x, 10));
    return a >= 1 && b >= 2 && a <= b && visible(e) && inFold(e) && !inOverlay(e);
  });
  const hero_carousel = !!(h1 && h1.closest(CAROUSEL)) || slideCounter || [...document.querySelectorAll("button[aria-label], a[aria-label], [role=tab][aria-label]")].some((e) => SLIDE_CONTROL.test(e.getAttribute("aria-label") || "") && visible(e) && inFold(e) && !inOverlay(e));
  const bodyP = [...document.querySelectorAll("main p, article p, p")].find((e) => visible(e) && (e.textContent || "").trim().length > 40) || null;
  const firstButton = [...document.querySelectorAll("a, button")].find((e) => visible(e) && inFold(e) && px(cs(e).paddingLeft) >= 8 && cs(e).backgroundColor !== "rgba(0, 0, 0, 0)") || null;

  // ---- layout ----
  const header = [...document.querySelectorAll("header, nav, [role=banner], [role=navigation]")].find((e) => visible(e) && e.getBoundingClientRect().top < 160);
  const navLinks = header ? [...header.querySelectorAll("a")].filter(visible).length : 0;
  const media = [...document.querySelectorAll("img, video, canvas, picture, svg, iframe")].filter((e) => visible(e) && inFold(e));
  const coverage = (sel) => media.filter((e) => e.matches(sel)).reduce((a, e) => a + foldArea(e), 0);
  const videoCov = coverage("video, iframe"), canvasCov = coverage("canvas"), imgCov = coverage("img, picture, svg");
  const hero_media = videoCov > 0.25 ? "video" : canvasCov > 0.25 ? "webgl" : imgCov > 0.25 ? "image" : "none";
  const ctas = [...document.querySelectorAll("a, button")].filter((e) => {
    if (!visible(e) || !inFold(e)) return false;
    const s = cs(e);
    return (s.backgroundColor !== "rgba(0, 0, 0, 0)" || px(s.borderTopWidth) >= 1) && px(s.paddingLeft) >= 8 && (e.textContent || "").trim().length > 1 && (e.textContent || "").trim().length < 40;
  });
  const radii = ctas.map((e) => { const s = cs(e); const r = px(s.borderTopLeftRadius); const h = e.getBoundingClientRect().height; return r >= h / 2 - 1 ? 999 : r; }).sort((a, b) => a - b);
  const median = (a) => (a.length ? a[Math.floor(a.length / 2)] : null);
  const grids = [...document.querySelectorAll("body *")].slice(0, 4000).filter((e) => cs(e).display.includes("grid"));
  const gridCols = grids.map((e) => cs(e).gridTemplateColumns.split(" ").filter((t) => t && t !== "none").length).filter((n) => n > 0);
  let h1Align = null;
  if (h1) {
    // Measure the text itself, not the (often full-width) block box.
    const range = document.createRange(); range.selectNodeContents(h1);
    const r = range.getBoundingClientRect();
    const ta = cs(h1).textAlign;
    const centered = ta === "center" || (Math.abs(r.left + r.width / 2 - VW / 2) < VW * 0.04 && r.width < VW * 0.8);
    h1Align = centered ? "center" : ta === "right" || ta === "end" || r.left > VW * 0.45 ? "right" : "left";
  }

  // Visible headline text: aria-label wins; otherwise skip glyph copies parked outside clipping boxes
  // (per-letter "roll" animations duplicate every character, so innerText reads "MMiissttrraall").
  // A headline rendered twice in the same element (one copy per breakpoint, both in the DOM) is one headline.
  const undouble = (s) => {
    const w = (s || "").split(" ");
    if (w.length < 4 || w.length % 2) return s;
    const h = w.length / 2;
    return w.slice(0, h).join(" ") === w.slice(h).join(" ") ? w.slice(0, h).join(" ") : s;
  };
  const headlineText = (el) => {
    if (!el) return null;
    const aria = (el.getAttribute("aria-label") || "").trim();
    if (aria.length > 3) return clean(aria, 300);
    const clips = [];
    for (let a = el; a; a = a === el ? null : a.parentElement) if (a === el || cs(a).overflow !== "visible") clips.push(a.getBoundingClientRect());
    const inner = [...el.querySelectorAll("*")].filter((a) => cs(a).overflow !== "visible" || cs(a).overflowY !== "visible");
    let out = "", prev = null;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode; const txt = t.textContent;
      if (!txt.trim()) { out += " "; continue; }
      const p = t.parentElement;
      if (p.closest("[aria-hidden=true]") && p.closest("[aria-hidden=true]") !== el) continue;
      const ps = cs(p);
      if (ps.visibility === "hidden" || Number(ps.opacity) < 0.05) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      const r = rg.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const boxes = [...clips, ...inner.filter((a) => a.contains(t)).map((a) => a.getBoundingClientRect())];
      if (!boxes.every((b) => cx >= b.left - 2 && cx <= b.right + 2 && cy >= b.top - 2 && cy <= b.bottom + 2)) continue;
      // Line break (<br>, wrapped block) or a visible gap between nodes = a word boundary.
      if (prev && (r.top > prev.top + prev.height * 0.5 || r.left > prev.right + 4)) out += " ";
      out += txt; prev = r;
    }
    out = undouble(clean(out, 300));
    return out.length >= 3 ? out : undouble(clean(el.innerText, 300));
  };

  // ---- composition ----
  const textChars = (() => {
    let n = 0;
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode; const p = t.parentElement;
      if (!p || !t.textContent.trim()) continue;
      const r = p.getBoundingClientRect();
      if (r.top < VH && r.bottom > 0 && visible(p)) n += t.textContent.trim().length;
    }
    return n;
  })();

  // ---- lexicon ----
  const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute("content") || null;
  const h2s = [...document.querySelectorAll("h2")].filter(visible).slice(0, 6).map((e) => clean(e.innerText, 120));

  // ---- tech ----
  const html = document.documentElement.outerHTML.slice(0, 400000);
  const has = (re) => re.test(html);
  const classTokens = [...document.querySelectorAll("[class]")].slice(0, 1500).flatMap((e) => String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).split(/\s+/));
  const tw = classTokens.filter((c) => /^(?:[a-z]+:)*(?:p|px|py|pt|pb|m|mx|my|mt|mb|gap|w|h|text|bg|rounded|flex|grid|items|justify|font|leading|tracking)(?:-[\w./[\]#%]+)+$/.test(c)).length;
  const w = window;
  const tech = {
    generator: meta("generator"),
    next: !!w.__NEXT_DATA__ || has(/\/_next\//), nuxt: !!w.__NUXT__ || has(/\/_nuxt\//),
    framer: has(/data-framer-|framerusercontent\.com/), webflow: has(/data-wf-page|webflow\.com/),
    wordpress: has(/\/wp-content\/|\/wp-includes\//), shopify: !!w.Shopify || has(/cdn\.shopify\.com/),
    squarespace: has(/static1\.squarespace\.com/), wix: has(/static\.wixstatic\.com|wix\.com/),
    astro: has(/astro-island|data-astro-/), gatsby: !!w.___gatsby, sveltekit: has(/__sveltekit/),
    tailwind: tw > 40, gsap: !!w.gsap || has(/gsap(\.min)?\.js/), lenis: document.documentElement.classList.contains("lenis") || has(/lenis/),
    three: !!w.THREE || has(/three(\.module)?(\.min)?\.js/), lottie: !!w.lottie || has(/lottie/),
    webgl_canvas: canvasCov > 0.05,
  };

  // ---- declared colors ----
  const bgOf = (el) => { let e = el; while (e) { const b = cs(e).backgroundColor; if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") return b; e = e.parentElement; } return "rgb(255, 255, 255)"; };
  const ctaColors = ctas.slice(0, 8).map((e) => cs(e).backgroundColor).filter((c) => c !== "rgba(0, 0, 0, 0)");

  // Adult sites self-label (RTA / rating meta); we drop them at crawl time as a second filter after the seed blocklist.
  const rating = (meta("rating") || meta("RATING") || "").toLowerCase();
  const adult = rating.includes("rta-5042") || rating === "adult" || rating === "mature";
  return {
    adult,
    url: location.href,
    title: clean(document.title, 200),
    lang: document.documentElement.lang || null,
    viewport: { w: VW, h: VH },
    type_declared: { h1: typeOf(h1), body: typeOf(bodyP), cta: typeOf(firstButton) },
    layout: {
      has_h1: headline_source === "h1", headline_source, h1_align: h1Align, h1_lines: h1 && typeOf(h1).line_height ? Math.round(h1.getBoundingClientRect().height / (typeOf(h1).line_height * typeOf(h1).size_px)) : null,
      h1_words: h1 ? (headlineText(h1) || "").split(" ").filter(Boolean).length : 0,
      has_nav: !!header, nav_links: navLinks, hero_media, hero_carousel,
      cta_count: ctas.length, cta_radius_px: median(radii),
      grid_count: grids.length, grid_max_cols: gridCols.length ? Math.max(...gridCols) : 0,
      page_height_vh: +(document.documentElement.scrollHeight / VH).toFixed(1),
      sections: document.querySelectorAll("main > section, body > section, main > div > section").length,
    },
    composition: {
      text_chars_fold: textChars,
      text_density: +(textChars / ((VW * VH) / 10000)).toFixed(2), // chars per 10k px²
      media_coverage: +Math.min(1, videoCov + canvasCov + imgCov).toFixed(3),
    },
    lexicon: {
      h1: headlineText(h1),
      h2: h2s,
      description: clean(meta("description") || meta("og:description"), 300) || null,
      ctas: [...new Set(ctas.map((e) => clean(e.innerText, 40)))].filter(Boolean).slice(0, 8),
    },
    colors_declared: {
      page_bg: bgOf(document.body || document.documentElement), body_text: bodyP ? cs(bodyP).color : cs(document.body || document.documentElement).color,
      h1_color: h1 ? cs(h1).color : null, cta_bgs: ctaColors,
    },
    tech,
  };
}
