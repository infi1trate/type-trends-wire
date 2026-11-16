// Minimal robots.txt check: is `path` allowed for our UA (or *)? Longest match wins; Allow wins ties.
// Rules addressed to either of our names count: slugbot, or DSGNTerminalBot (the name published first).
export const BOT_TOKENS = "slugbot dsgnterminalbot";
const ruleRe = (p) => new RegExp("^" + p.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$|\$$/, "$"));

export function homepageAllowed(robotsTxt, ua = BOT_TOKENS, path = "/") {
  if (!robotsTxt) return true;
  const groups = [];
  let cur = null;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    const key = k.toLowerCase();
    if (key === "user-agent") {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
    } else if ((key === "disallow" || key === "allow") && cur) cur.rules.push({ allow: key === "allow", path: v });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  const group = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  let best = { len: -1, allow: true };
  for (const g of group) for (const r of g.rules) {
    if (!r.path) continue; // "Disallow:" (empty) allows everything
    const rp = r.path.startsWith("/") || r.path.startsWith("*") ? r.path : "/" + r.path;
    if (!ruleRe(rp).test(path)) continue;
    const len = rp.length;
    if (len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best.allow;
}
