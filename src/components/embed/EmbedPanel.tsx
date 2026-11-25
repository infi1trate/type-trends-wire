import { useId, useState } from "react";
import { embedSnippet, embedSrc, type Theme } from "@/lib/embed/embed";
import { SITE_URL } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";

type Target = { kind: "trait"; key: string } | { kind: "chart"; week: string };
/** "Embed" action: iframe snippet with copy, light/dark toggle and a live preview. Works in the editorial and terminal skins. */
export function EmbedPanel({ target, title, scope, variant = "editorial" }: { target: Target; title: string; scope?: string; variant?: "editorial" | "terminal" }) {
  const [open, setOpen] = useState(false), [theme, setTheme] = useState<Theme>("light"), [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle"), id = useId();
  const src = embedSrc(target, { theme, scope }), snippet = embedSnippet(src, title), preview = src.replace(SITE_URL, "");
  const ed = variant === "editorial";
  const btn = ed ? "ed-tap ed-data cursor-pointer underline" : "label inline-flex min-h-11 items-center px-2 text-ink hover:underline md:min-h-8";
  const toggle = (t: Theme) => <button type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} className={`${btn} ${theme === t ? "" : ed ? "ed-muted no-underline" : "text-g500"}`}>{t === "light" ? "Light" : "Dark"}</button>;
  return <div className="no-print">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)} className={btn}>{open ? "Close embed" : "Embed →"}</button>
    {open && <div id={id} className={ed ? "ed-hair mt-3 space-y-3 pt-3" : "mt-2 space-y-2 border border-rule p-3"} role="region" aria-label="Embed this chart">
      <div className="flex flex-wrap items-center gap-x-3" role="group" aria-label="Embed theme">{toggle("light")}{toggle("dark")}</div>
      <label className={ed ? "ed-kicker block" : "label block text-g500"} htmlFor={`${id}-code`}>Snippet</label>
      <textarea id={`${id}-code`} readOnly value={snippet} rows={4} onFocus={e => e.currentTarget.select()} className={`w-full resize-none border p-2 font-mono text-chip leading-4 ${ed ? "border-ed-ink bg-transparent" : "border-rule bg-void text-ink"}`} />
      <div className="flex flex-wrap items-center gap-x-3">
        <button type="button" className={btn} onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied("ok"); setTimeout(() => setCopied("idle"), 1200); } catch { setCopied("failed"); } }}>{copied === "ok" ? "Copied" : "Copy snippet"}</button>
        <span role="status" className={ed ? "ed-caption" : "label text-g500"}>{copied === "failed" ? "Copy failed: select the snippet and copy it." : "Responsive from 280 to 800 px wide, 4:3."}</span>
      </div>
      <p className={ed ? "ed-kicker" : "label text-g500"}>Preview</p>
      <iframe key={preview} src={preview} title={`${title} — ${BRAND_NAME} signal chart (preview)`} style={{ width: "100%", maxWidth: 800, minWidth: 280, aspectRatio: "4 / 3", height: "auto", border: 0 }} loading="lazy" />
    </div>}
  </div>;
}
