/** A2 · one percentage-sign treatment, enabled only by a display-size figure role. */
export function FigureNumber({ text }: { text: string }) {
  if (!text.endsWith("%")) return <>{text}</>;
  return <>{text.slice(0, -1)}<span className="figure-percent">%</span></>;
}
