// B1c · one shared readout strip per group of small charts (tiles, table sparklines, anything under 240 px wide):
// a reserved-height row directly above the grid or table names the tile and the point; tiles draw only a point marker.
import { createContext, useContext, useState, type ReactNode } from "react";

type Strip = { text: string; owner: string | null; show: (owner: string, text: string) => void; clear: (owner: string) => void };
const Ctx = createContext<Strip | null>(null);
export const useReadoutStrip = () => useContext(Ctx);

export function ReadoutGroup({ children, hint = "Point at or tap a chart to read it." }: { children: ReactNode; hint?: string }) {
  const [state, set] = useState<{ text: string; owner: string | null }>({ text: "", owner: null });
  const strip: Strip = { ...state, show: (owner, text) => set({ owner, text }), clear: owner => set(s => s.owner === owner ? { owner: null, text: "" } : s) };
  return <Ctx.Provider value={strip}>
    <p className="chart-strip ed-data" data-readout-strip="" aria-live="polite" aria-atomic="true">{state.text || <span className="ed-muted">{hint}</span>}</p>
    {children}
  </Ctx.Provider>;
}
