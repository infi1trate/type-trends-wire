// Runs INSIDE the page (page.evaluate). Plain browser JS, no imports.
// Structure of a page as a visitor meets it (roadmap 2, J1 and M1): the order of its sections, what it asks
// for on the first screen, its furniture (search, chat, an "ask AI" box, a language switch, sign-in), and on a
// phone-width capture how it handles navigation, tap sizes and the push to an app. Everything here is read
// from the rendered public page. Nothing is clicked, typed or submitted. Output is kept small (about 1 KB).
export function extractStructure() {
  const VW = window.innerWidth, VH = window.innerHeight;
  const sx = window.scrollX, sy = window.scrollY;
  const root = document.body || document.documentElement;
  const cs = (el) => getComputedStyle(el);
  const clean = (t, max = 48) => (t || "").replace(/\s+/g, " ").trim().slice(0, max);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height }; };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = cs(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const PRICE = /(?:[$€£¥₹]\s?\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?)(?:\s?(?:\/|per)\s?(?:mo|month|yr|year|user|seat|member))?/gi;
  const CONTROL = "button, [role=button], input[type=submit], input[type=button], a[class*=btn i], a[class*=button i], a[class*=cta i]";
  const filled = (el) => { const b = cs(el).backgroundColor; return !!b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent"; };
  const isControl = (el) => el.matches(CONTROL) || (el.tagName === "A" && filled(el) && rect(el).h <= 80);

  // ---- sections, in the order a visitor scrolls through them ----
  const cands = [];
  for (const el of document.querySelectorAll("main > *, body > section, body > div > section, main > div > section, body > div > div > section, body > footer, body > div > footer, footer")) {
    if (!shown(el)) continue;
    const r = rect(el);
    if (r.h < 120 || r.w < VW * 0.6) continue;
    if (!cands.some((c) => c.el === el)) cands.push({ el, ...r });
  }
  // A wrapper that holds two or more other candidates is a container, not a section.
  const containers = new Set(cands.filter((c) => cands.filter((o) => o !== c && c.el.contains(o.el)).length >= 2));
  let kept = cands.filter((c) => !containers.has(c));
  kept = kept.filter((c) => !kept.some((o) => o !== c && o.el.contains(c.el)));
  kept.sort((a, b) => a.y - b.y);
  const ROLE_BY_HEADING = [
    [/pricing|plans|choose your plan/i, "pricing"],
    [/faq|frequently asked|questions/i, "faq"],
    [/testimonial|customers say|what (people|teams|customers|they).{0,12}say|loved by|wall of love/i, "testimonials"],
    [/trusted by|used by|backed by|as seen in|featured in|our customers|our clients|partners/i, "logos"],
    [/how it works|how .{0,20} works/i, "how"],
    [/integrations?|works with|connect(s)? (to|with)/i, "integrations"],
    [/case stud|customer stor|selected work|our work|projects|portfolio/i, "work"],
    [/blog|news|latest|articles|resources|journal/i, "news"],
    [/team|about us|who we are|our story/i, "about"],
    [/newsletter|subscribe|stay in the loop|get updates/i, "signup"],
  ];
  const sections = [];
  kept.slice(0, 24).forEach((c, i) => {
    const el = c.el;
    const txt = (el.innerText || "").slice(0, 6000);
    const hEl = el.querySelector("h1, h2, h3");
    const heading = clean(hEl?.innerText, 48);
    const controls = [...el.querySelectorAll(CONTROL)].filter(shown).length;
    const media = [...el.querySelectorAll("img, picture, video, canvas, svg")].filter((m) => { const r = m.getBoundingClientRect(); return r.width >= 48 && r.height >= 48; });
    const smallImgs = [...el.querySelectorAll("img, svg")].filter((m) => { const r = m.getBoundingClientRect(); return r.height >= 12 && r.height <= 72 && r.width >= 32 && r.width <= 240; }).length;
    const words = txt.split(/\s+/).filter(Boolean).length;
    const links = el.querySelectorAll("a[href]").length;
    const prices = (txt.match(PRICE) || []).length;
    const stats = [...el.querySelectorAll("p, span, div, strong, h2, h3, h4")].filter((n) => n.children.length === 0 && /^[$€£]?\d[\d,.]*\s?(%|\+|k|m|b|x|bn|ms|s)?\+?$/i.test((n.textContent || "").trim()) && parseFloat(cs(n).fontSize) >= 24).length;
    const hasVideo = !!el.querySelector("video, iframe[src*=youtube], iframe[src*=vimeo], iframe[src*=wistia], iframe[src*=loom]");
    const hasQuote = !!el.querySelector("blockquote, figure cite, [class*=testimonial i], [class*=quote i]");
    const hasFaq = el.querySelectorAll("details, [class*=accordion i] button, [aria-expanded]").length >= 3;
    const hasEmail = !!el.querySelector("input[type=email], input[name*=email i], input[placeholder*=email i]");
    const hasCode = !!el.querySelector("pre, code");
    const inputs = [...el.querySelectorAll("input:not([type=hidden]), textarea, select")].filter(shown).length;
    // Repeated cards: three or more siblings of similar size somewhere inside.
    let cards = 0;
    for (const p of el.querySelectorAll("ul, ol, div")) {
      const kids = [...p.children].filter((k) => { const r = k.getBoundingClientRect(); return r.width >= 120 && r.height >= 100; });
      if (kids.length < 3 || kids.length > 24) continue;
      const w0 = kids[0].getBoundingClientRect().width;
      if (kids.every((k) => Math.abs(k.getBoundingClientRect().width - w0) < 8)) { cards = Math.max(cards, kids.length); }
    }
    let role = null;
    const isFooter = el.tagName === "FOOTER" || el.matches("[role=contentinfo]") || (i === kept.length - 1 && links >= 15 && media.length <= 3);
    if (isFooter) role = "footer";
    else if (i === 0 || (el.querySelector("h1") && c.y < VH)) role = "hero";
    // The heading names the section; a section with no heading is named by its opening words ("Trusted by teams at").
    const label = heading || clean(txt, 60);
    if (!role) for (const [re, r] of ROLE_BY_HEADING) if (label && re.test(label) && (heading || words < 40)) { role = r; break; }
    if (!role) {
      if (hasFaq) role = "faq";
      else if (prices >= 2) role = "pricing";
      else if (hasQuote) role = "testimonials";
      else if (smallImgs >= 5 && words < 60) role = "logos";
      else if (stats >= 3) role = "stats";
      else if (hasEmail && words < 80) role = "signup";
      else if (hasCode) role = "code";
      else if (hasVideo && words < 80) role = "video";
      else if (c.h < VH * 0.9 && controls >= 1 && words < 60 && media.length <= 1) role = "ask";
      else if (cards >= 3) role = "cards";
      else if (media.length >= 1 && words >= 15) role = "feature";
      else role = "content";
    }
    sections.push({ r: role, y: Math.round(c.y), h: Math.round(c.h), ...(heading ? { t: heading } : {}), c: controls, m: media.length, w: Math.min(words, 9999), ...(cards >= 3 ? { k: cards } : {}), ...(inputs ? { f: inputs } : {}) });
  });

  // ---- what the first screen asks for ----
  const ASK_KIND = [
    [/book (a )?demo|request (a )?demo|get (a )?demo|see (a )?demo|schedule (a )?(demo|call)|watch (a |the )?demo/i, "demo"],
    [/contact sales|talk to (sales|us|an expert)|get in touch|contact us/i, "sales"],
    [/start (for )?free|try (it |.{0,20} )?(for )?free|get started|sign ?up|create (an |your )?account|start (building|now|your)|start trial|free trial|try now|open (an )?account/i, "start"],
    [/join (the )?wait ?list|request access|get early access|apply/i, "waitlist"],
    [/download|get the app|install/i, "download"],
    [/shop|buy|add to (cart|bag)|order now|pre-?order/i, "shop"],
    [/subscribe|join (now|us)|become a member/i, "subscribe"],
    [/log ?in|sign ?in/i, "signin"],
    [/learn more|read more|explore|see how|how it works|view|discover/i, "learn"],
  ];
  const askKind = (label) => { for (const [re, k] of ASK_KIND) if (re.test(label)) return k; return "other"; };
  const asks = [];
  const seenAsk = new Set();
  for (const el of document.querySelectorAll(CONTROL + ", a[href]")) {
    if (asks.length >= 8) break;
    if (!shown(el) || !isControl(el)) continue;
    const r = rect(el);
    if (r.y >= VH || r.y < 0) continue;
    const label = clean(el.innerText || el.value || el.getAttribute("aria-label"), 32);
    if (!label || label.length < 2 || seenAsk.has(label.toLowerCase())) continue;
    if (/^(menu|close|search|accept|reject|decline|ok|got it|skip|dismiss|allow|deny|manage|preferences)\b/i.test(label) || /cookie/i.test(label)) continue;
    seenAsk.add(label.toLowerCase());
    asks.push({ l: label, k: askKind(label), p: filled(el) ? 1 : 0, n: r.y < 100 ? 1 : 0 });
  }

  // ---- furniture ----
  const header = [...document.querySelectorAll("header, nav, [role=banner], [role=navigation]")].find((e) => e.getBoundingClientRect().top < 200);
  const headText = clean(header?.innerText, 2000);
  const navLabels = header ? [...header.querySelectorAll("a[href], button")].filter(shown).map((a) => clean(a.innerText || a.getAttribute("aria-label"), 40)).filter(Boolean) : [];
  const html = document.documentElement.outerHTML.slice(0, 1500000);
  const CHAT = { intercom: /intercom/i, drift: /drift\.com|driftt/i, crisp: /crisp\.chat/i, zendesk: /zdassets|zopim|zendesk/i, hubspot: /hubspot-messages|js\.usemessages/i, tawk: /tawk\.to/i, front: /frontapp|front-chat/i, livechat: /livechatinc/i, gorgias: /gorgias/i, freshchat: /freshchat|wchat\.freshchat/i, tidio: /tidio/i, olark: /olark/i, kustomer: /kustomer/i, pylon: /usepylon|pylon-chat/i, plain: /plain\.com\/chat/i };
  const chat = Object.entries(CHAT).filter(([, re]) => re.test(html)).map(([k]) => k)[0] ?? null;
  const ASK_AI = /ask (ai|anything|a question|our ai|the ai|copilot|the docs)|chat with (ai|our ai|an ai)|ai assistant|ask .{0,16} ai\b/i;
  let askAi = null;
  for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder], button, a[href], [role=button]")) {
    if (!shown(el)) continue;
    const t = clean(el.getAttribute("placeholder") || el.innerText || el.getAttribute("aria-label"), 60);
    if (t && ASK_AI.test(t)) { askAi = t.slice(0, 40); break; }
  }
  const promptBox = [...document.querySelectorAll("textarea, input[type=text]")].some((el) => { if (!shown(el)) return false; const r = rect(el); return r.y < VH && r.w >= Math.min(320, VW * 0.6) && r.h >= 40; });
  const search = !!document.querySelector("input[type=search], [role=search], form[action*=search i], button[aria-label*=search i], a[aria-label*=search i], [class*=search i] input, [data-docsearch], .DocSearch");
  const cmdk = /(⌘|ctrl)\s?\+?\s?k\b/i.test(headText) || !!document.querySelector("kbd");
  const hreflang = document.querySelectorAll("link[rel=alternate][hreflang]").length;
  const langSwitch = !!document.querySelector("[aria-label*=language i], [class*=lang-switch i], [class*=language-s i], [class*=locale i] select, select[name*=lang i], select[name*=locale i], [data-testid*=language i]");
  const login = navLabels.find((l) => /^(log ?in|sign ?in|login|my account|account)$/i.test(l)) ?? null;
  const pricingNav = navLabels.some((l) => /^(pricing|plans|plans (&|and) pricing)$/i.test(l));
  const themeToggle = !!document.querySelector("button[aria-label*=theme i], button[aria-label*='dark mode' i], button[aria-label*='light mode' i], [class*=theme-toggle i]");
  // Announcement bar: a thin full-width strip with text at the very top, above or inside the header.
  let bar = null;
  for (const el of document.querySelectorAll("body > *, body > div > *, header > *")) {
    const r = rect(el);
    if (r.y > 80 || r.h < 20 || r.h > 72 || r.w < VW * 0.9 || !shown(el)) continue;
    const t = clean(el.innerText, 80);
    if (t && t.length >= 12 && t.split(" ").length >= 3 && el.querySelectorAll("a, button").length <= 3 && !el.querySelector("nav, input")) { bar = t; break; }
  }
  const furniture = {
    ...(search ? { search: 1 } : {}), ...(cmdk ? { cmdk: 1 } : {}), ...(chat ? { chat } : {}), ...(askAi ? { ask_ai: askAi } : {}), ...(promptBox ? { prompt_box: 1 } : {}),
    ...(hreflang ? { hreflang: Math.min(hreflang, 200) } : {}), ...(langSwitch ? { lang_switch: 1 } : {}), ...(login ? { login } : {}), ...(pricingNav ? { pricing_nav: 1 } : {}),
    ...(themeToggle ? { theme_toggle: 1 } : {}), ...(bar ? { bar } : {}),
  };

  // ---- phone-width reading ----
  // A phone capture is told by the device width: a page that overflows sideways can report a wider window.
  let mobile = null;
  const DEVICE_W = Math.min(VW, (window.screen && window.screen.width) || VW);
  if (DEVICE_W <= 500) {
    const fixedEls = [...document.querySelectorAll("body *")].slice(0, 6000).filter((el) => { const p = cs(el).position; return (p === "fixed" || p === "sticky") && shown(el); });
    const menuBtn = [...document.querySelectorAll("button, [role=button], a, summary, label")].find((el) => {
      if (!shown(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.top > 120) return false;
      const t = `${el.getAttribute("aria-label") || ""} ${el.className && typeof el.className === "string" ? el.className : ""} ${el.id || ""} ${clean(el.innerText, 20)}`;
      return /\b(menu|navigation|hamburger|burger|nav-toggle|navbar-toggle|toggle navigation)\b/i.test(t) || el.hasAttribute("aria-controls") && r.width <= 64 && r.height <= 64 && !clean(el.innerText, 20);
    });
    const bottomBar = fixedEls.find((el) => { const r = el.getBoundingClientRect(); return r.bottom >= VH - 2 && r.top > VH * 0.6 && r.width >= VW * 0.9 && el.querySelectorAll("a[href], button").length >= 3; });
    const inlineLinks = header ? [...header.querySelectorAll("a[href]")].filter(shown).length : 0;
    const nav = menuBtn ? (bottomBar ? "drawer+bar" : "drawer") : bottomBar ? "bar" : inlineLinks >= 3 ? "inline" : "none";
    const sticky = fixedEls.find((el) => { const r = el.getBoundingClientRect(); return el !== bottomBar && r.top > VH * 0.55 && r.width >= VW * 0.5 && r.height <= 140 && [...el.querySelectorAll(CONTROL + ", a[href]")].some((c) => shown(c) && isControl(c)); });
    const stickyLabel = sticky ? clean([...sticky.querySelectorAll(CONTROL + ", a[href]")].find((c) => shown(c) && isControl(c))?.innerText, 32) : null;
    const taps = [...document.querySelectorAll("a[href], button, [role=button], input, select, summary")].filter((el) => { if (!shown(el)) return false; const r = rect(el); return r.y < VH * 2; }).map((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height); });
    taps.sort((a, b) => a - b);
    const ps = [...document.querySelectorAll("p")].filter(shown).slice(0, 80).map((p) => parseFloat(cs(p).fontSize)).filter((n) => n > 0).sort((a, b) => a - b);
    const h1 = document.querySelector("h1");
    const storeLinks = [...document.querySelectorAll("a[href*='apps.apple.com'], a[href*='itunes.apple.com'], a[href*='play.google.com'], a[href*='onelink.me'], a[href*='app.link'], a[href*='apps.microsoft.com']")].filter((a) => shown(a));
    const storeFirst = storeLinks.filter((a) => rect(a).y < VH * 2).length;
    const appPrompt = /open in (the )?app|get the app|download the app|use the app|continue in app|better in the app/i.test((root.innerText || "").slice(0, 3000));
    mobile = {
      nav, tap_n: taps.length, ...(taps.length ? { tap_med: Math.round(taps[Math.floor(taps.length / 2)]), tap_small: Math.round((taps.filter((t) => t < 44).length / taps.length) * 100) } : {}),
      ...(ps.length ? { body_px: Math.round(ps[Math.floor(ps.length / 2)] * 10) / 10 } : {}), ...(h1 && shown(h1) ? { h1_px: Math.round(parseFloat(cs(h1).fontSize)) } : {}),
      ...(sticky ? { sticky: stickyLabel || 1 } : {}), ...(document.querySelector("meta[name='apple-itunes-app']") ? { smart_banner: 1 } : {}),
      ...(storeLinks.length ? { store_links: Math.min(storeLinks.length, 20), store_first: storeFirst } : {}), ...(appPrompt ? { app_prompt: 1 } : {}),
      ...(document.documentElement.scrollWidth > DEVICE_W + 2 ? { overflow_x: 1 } : {}),
      first: { c: asks.length, m: [...document.querySelectorAll("img, picture, video, canvas")].filter((m) => { if (!shown(m)) return false; const r = rect(m); return r.y < VH && r.w >= 80 && r.h >= 80; }).length },
    };
  }

  return { v: 1, vw: VW, vh: VH, screens: Math.round((document.documentElement.scrollHeight / VH) * 10) / 10, sections: sections.slice(0, 16), n_sections: kept.length, asks, furniture, ...(mobile ? { mobile } : {}) };
}
