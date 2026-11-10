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
  const h1 = [...document.querySelectorAll("h1")].find((e) => visible(e)) || null;
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

  // ---- composition ----
  const textChars = (() => {
    let n = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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
      has_h1: !!h1, h1_align: h1Align, h1_lines: h1 && typeOf(h1).line_height ? Math.round(h1.getBoundingClientRect().height / (typeOf(h1).line_height * typeOf(h1).size_px)) : null,
      h1_words: h1 ? clean(h1.innerText, 400).split(" ").filter(Boolean).length : 0,
      has_nav: !!header, nav_links: navLinks, hero_media,
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
      h1: h1 ? clean(h1.innerText, 300) : null,
      h2: h2s,
      description: clean(meta("description") || meta("og:description"), 300) || null,
      ctas: [...new Set(ctas.map((e) => clean(e.innerText, 40)))].filter(Boolean).slice(0, 8),
    },
    colors_declared: {
      page_bg: bgOf(document.body), body_text: bodyP ? cs(bodyP).color : cs(document.body).color,
      h1_color: h1 ? cs(h1).color : null, cta_bgs: ctaColors,
    },
    tech,
  };
}
