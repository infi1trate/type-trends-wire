// U1 · a study figure's data as plain tables (head + rows of strings): the same rows the study's own screen-reader tables show, for the
// study's Data view, its "Download CSV" links and the figure receipt in the drawer. Pure.
import type { Figure } from "../data-stories/types";
import { dayText, pctText, qText } from "../data-stories/text";
import type { ReceiptTable } from "./receipts";

const q = (x: string) => (/^\d{4}Q[1-4]$/.test(x) ? qText(x) : x);
const px = (unit: string, v: number) => (unit === "px" ? `${Math.round(v)}px` : pctText(v));
export function figureTables(fig: Figure): ReceiptTable[] {
  switch (fig.kind) {
    case "multiples": {
      const f = (y: number) => (fig.unit === "share" ? pctText(y) : String(y));
      return [{ caption: fig.title, head: [fig.chart === "bars" ? "Sector" : "Signal", ...fig.xs.map(q)],
        rows: fig.panels.map(p => [p.note ? `${p.label} (${p.note.toLowerCase()})` : p.label, ...fig.xs.map(x => { const pt = p.points.find(v => v.x === x); return pt ? f(pt.y) : "–"; })]) }];
    }
    case "adoption":
      return [
        { caption: `${fig.signal.name}: share of tracked homepages by quarter`, head: ["Quarter", "Share"], rows: fig.share.map(p => [q(p.x), pctText(p.y)]) },
        { caption: `${fig.title}: every adopter`, head: ["Brand", "First seen", "Note"], rows: fig.adopters.map(a => [a.name, q(a.first), [a.censored ? "already there" : "", a.dropped ? "since dropped" : ""].filter(Boolean).join(", ") || "–"]) },
      ];
    case "field":
      return [{ caption: fig.title, head: ["Brand", fig.axes.x.label, fig.axes.y.label], rows: fig.points.map(p => [p.name, px(fig.axes.x.unit, p.x), px(fig.axes.y.unit, p.y)]) }];
    case "drift":
      return [{ caption: fig.title, head: ["Quarter", "Brands", "Colours"], rows: fig.bands.map(b => [q(b.q), String(b.brands), [b.swatches.map(x => x.label ?? x.hex).join(", "), b.note ?? "", ...(b.pairs ?? []).map(p => `${p.domain} ${p.brandHex} beside ${p.credit} (${p.workHex}, holds ${Math.round(p.share * 100)}% of the picture)`)].filter(Boolean).join(". ")]) }];
    case "before-after":
      return [{ caption: `${fig.title} (${dayText(fig.before.at)} and ${dayText(fig.after.at)})`, head: ["Field", "Before", "After"], rows: fig.diffs.length ? fig.diffs.map(d => [d.field, d.before, d.after]) : [["–", "The compared fields measure the same.", "–"]] }];
    case "strip":
      return [{ caption: fig.title, head: ["Capture", "From"], rows: fig.frames.map(fr => [dayText(fr.at), fr.source === "live" ? "Live crawl" : "Wayback archive"]) }];
  }
}
