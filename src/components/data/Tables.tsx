// E4 · the data behind each figure as plain tables (one disclosure on the study page; screen readers can open it). Pure render.
import type { Figure } from "@/lib/data-stories/types";
import { dayText, pctText, qText } from "@/lib/data-stories/text";

const q = (x: string) => (/^\d{4}Q[1-4]$/.test(x) ? qText(x) : x);
const Wrap = ({ caption, children }: { caption: string; children: React.ReactNode }) =>
  <div className="mt-6 overflow-x-auto first:mt-0" data-figure-table=""><table className="tk-t-data w-full min-w-[20rem] border-collapse text-left"><caption className="ed-kicker pb-2 text-left">{caption}</caption>{children}</table></div>;
const th = "border-b px-2 py-1 font-semibold", td = "border-b px-2 py-1 align-top";
const rule = { borderColor: "var(--tk-rule-hairline)" };
export function FigureTable({ fig }: { fig: Figure }) {
  switch (fig.kind) {
    case "multiples": {
      const f = (y: number) => (fig.unit === "share" ? pctText(y) : String(y));
      return <Wrap caption={fig.title}><thead><tr><th scope="col" className={th} style={rule}>{fig.chart === "bars" ? "Sector" : "Signal"}</th>{fig.xs.map(x => <th key={x} scope="col" className={th} style={rule}>{q(x)}</th>)}</tr></thead>
        <tbody>{fig.panels.map(p => <tr key={p.id}><th scope="row" className={td} style={rule}>{p.label}</th>{fig.xs.map(x => { const pt = p.points.find(v => v.x === x); return <td key={x} className={td} style={rule}>{pt ? f(pt.y) : "–"}</td>; })}</tr>)}</tbody></Wrap>;
    }
    case "adoption":
      return <>
        <Wrap caption={`${fig.signal.name}: share of tracked homepages by quarter`}><thead><tr><th scope="col" className={th} style={rule}>Quarter</th><th scope="col" className={th} style={rule}>Share</th></tr></thead>
          <tbody>{fig.share.map(p => <tr key={p.x}><th scope="row" className={td} style={rule}>{q(p.x)}</th><td className={td} style={rule}>{pctText(p.y)}</td></tr>)}</tbody></Wrap>
        <Wrap caption={`${fig.title}: every adopter`}><thead><tr><th scope="col" className={th} style={rule}>Brand</th><th scope="col" className={th} style={rule}>First seen</th><th scope="col" className={th} style={rule}>Note</th></tr></thead>
          <tbody>{fig.adopters.map(a => <tr key={a.domain}><th scope="row" className={td} style={rule}>{a.name}</th><td className={td} style={rule}>{q(a.first)}</td><td className={td} style={rule}>{[a.censored ? "already there" : "", a.dropped ? "since dropped" : ""].filter(Boolean).join(", ") || "–"}</td></tr>)}</tbody></Wrap>
      </>;
    case "field":
      return <Wrap caption={fig.title}><thead><tr><th scope="col" className={th} style={rule}>Brand</th><th scope="col" className={th} style={rule}>{fig.axes.x.label}</th><th scope="col" className={th} style={rule}>{fig.axes.y.label}</th></tr></thead>
        <tbody>{fig.points.map(p => <tr key={p.domain}><th scope="row" className={td} style={rule}>{p.name}</th><td className={td} style={rule}>{fig.axes.x.unit === "px" ? `${Math.round(p.x)}px` : pctText(p.x)}</td><td className={td} style={rule}>{fig.axes.y.unit === "px" ? `${Math.round(p.y)}px` : pctText(p.y)}</td></tr>)}</tbody></Wrap>;
    case "drift":
      return <Wrap caption={fig.title}><thead><tr><th scope="col" className={th} style={rule}>Quarter</th><th scope="col" className={th} style={rule}>Brands</th><th scope="col" className={th} style={rule}>Colours</th></tr></thead>
        <tbody>{fig.bands.map(b => <tr key={b.q}><th scope="row" className={td} style={rule}>{q(b.q)}</th><td className={td} style={rule}>{b.brands}</td><td className={td} style={rule}>{b.swatches.map(x => x.hex).join(", ")}</td></tr>)}</tbody></Wrap>;
    case "before-after":
      return <Wrap caption={`${fig.title} (${dayText(fig.before.at)} and ${dayText(fig.after.at)})`}><thead><tr><th scope="col" className={th} style={rule}>Field</th><th scope="col" className={th} style={rule}>Before</th><th scope="col" className={th} style={rule}>After</th></tr></thead>
        <tbody>{fig.diffs.length ? fig.diffs.map(d => <tr key={d.field}><th scope="row" className={td} style={rule}>{d.field}</th><td className={td} style={rule}>{d.before}</td><td className={td} style={rule}>{d.after}</td></tr>) : <tr><td className={td} style={rule} colSpan={3}>The compared fields measure the same.</td></tr>}</tbody></Wrap>;
    case "strip":
      return <Wrap caption={fig.title}><thead><tr><th scope="col" className={th} style={rule}>Capture</th><th scope="col" className={th} style={rule}>From</th></tr></thead>
        <tbody>{fig.frames.map(fr => <tr key={fr.id}><th scope="row" className={td} style={rule}>{dayText(fr.at)}</th><td className={td} style={rule}>{fr.source === "live" ? "Live crawl" : "Wayback archive"}</td></tr>)}</tbody></Wrap>;
  }
}
