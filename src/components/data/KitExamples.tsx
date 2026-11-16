// /kit: the six data story views, each a small live example on fixture data (the same fixtures the tests use).
import { useMemo } from "react";
import { fxInput, fxCapture } from "@/lib/data-stories/fixtures";
import { bigTypeStory, sectorMindsStory, sectorField } from "@/lib/data-stories/stories";
import { beforeAfter, strip } from "@/lib/data-stories/templates/frames";
import { paletteDrift } from "@/lib/data-stories/templates/drift";
import { snapIndex, rowsIn } from "@/lib/data-stories/series";
import { TEMPLATES } from "@/lib/data-stories/registry";
import type { Figure, View } from "@/lib/data-stories/types";
import { FigureView } from "./Figures";

const META = { slug: "kit", number: 0, question: "", deck: "", template: "", collection: { label: "", href: "/data" }, related: [] };
export function DataKitExamples() {
  const ex = useMemo(() => {
    const i = fxInput({ perSector: 16 }), snaps = snapIndex(i);
    const a = fxCapture(1, "2021-02-10T00:00:00Z"), b = fxCapture(2, "2023-02-10T00:00:00Z", { h1_size: 88 }), c = fxCapture(3, "2026-11-14T00:00:00Z", { source: "live", bg: "#0A0A0A" });
    const drift = paletteDrift({ title: "Fixture palette by quarter", note: "One band per well-covered quarter from stored palette colours, weighted by share.", scope: "fintech", quarters: ["2021Q1", "2022Q1", "2023Q1", "2024Q1", "2026Q4"],
      captures: rowsIn(i, ["fintech"]).map(r => ({ domain: r.domain, q: r.quarter, palette: snaps.get(r.snapshot_id!)?.palette ?? [] })), minBrands: 10 });
    const out: [keyof typeof TEMPLATES, Figure, View, string][] = [
      ["adoption", bigTypeStory(i, new Map(), META).figures["adoption"]!, { figure: "", highlight: [], focus: "2022Q1" }, "Adopters enter at their first well-covered sighting; outlined squares started before the record or dropped it."],
      ["before-after", beforeAfter({ title: "Fixture brand, then and now", note: "Two redrawn captures; slide or use the two buttons.", domain: "x.example", name: "Fixture", a, b: c, crops: [] }), { figure: "", highlight: [], side: "split" }, "Keyboard: the range input, or the two labelled buttons."],
      ["multiples", sectorMindsStory(i, new Map(), META).figures["multiples"]!, { figure: "", highlight: ["fintech"] }, "One panel per sector, same axes; the step's sector comes forward."],
      ["field", sectorField(i, "fintech"), { figure: "", highlight: ["b32.example"], focus: "centre" }, "Two measured axes, the sector centre (medians) and labelled extremes."],
      ["drift", drift.fig, { figure: "", highlight: drift.entered.map(s => s.id), focus: null }, "Real hexes, grouped into colour families; entering families are outlined."],
      ["strip", strip({ title: "Fixture brand through time", note: "Every stored capture, redrawn; play, pause or step.", domain: "x.example", name: "Fixture", captures: [a, b, c], events: [{ id: 7, at: "2023-01-20T00:00:00Z", type: "type_change" }], crops: [] }), { figure: "", highlight: ["7"], focus: "2" }, "Dated changes are marked under the capture that first shows them."],
    ];
    return out;
  }, []);
  return <div className="grid gap-10 xl:grid-cols-2" data-kit="data-stories">{ex.map(([t, fig, view, note]) => <div key={t} className="min-w-0">
    <p className="tk-t-kicker">{TEMPLATES[t]}</p><p className="tk-t-small tk-c-secondary mb-3 mt-1">{note}</p>
    <FigureView fig={fig} view={view} live />
  </div>)}</div>;
}
