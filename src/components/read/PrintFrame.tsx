// What every printed Read page carries (README "Print"): the mark at the top of the first sheet, the page's address and the print
// date at the foot of every sheet (a fixed element repeats per page), and, on pages whose receipts matter (stories, signals, audit
// reports: marked [data-receipts]), each linked address once as a numbered footnote instead of inline. Hidden on screen.
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { SITE_HOST } from "@/lib/brand";
import { readablePath } from "@/lib/path-text";

export type Note = { n: number; href: string };
/** Number each distinct address once, in reading order; the same address reuses its number. Pure (tested). */
export function footnotes(hrefs: string[]): { notes: Note[]; numbers: number[] } {
  const seen = new Map<string, number>(), notes: Note[] = [];
  const numbers = hrefs.map(h => { let n = seen.get(h); if (n == null) { n = seen.size + 1; seen.set(h, n); notes.push({ n, href: h }); } return n; });
  return { notes, numbers };
}

/** U3 · the address printed at the foot of a sheet, in its readable decoded form. The server's router hands the page a decoded path
 *  ("/stories/brand:coinbase.com:2026-11-20") while the browser's is encoded ("%3A"); decoding both makes the two renders the same
 *  text (React #418 otherwise). A path that does not decode is printed as it is. Pure (tested). */
export const printPath = readablePath;

/** The mark at the top of the first printed sheet. */
export const PrintMark = () => <div className="print-only print-mark" aria-hidden="true"><Wordmark height={28} decorative /></div>;

export function PrintFrame({ path }: { path: string }) {
  const [notes, setNotes] = useState<Note[]>([]), [date, setDate] = useState("");
  useEffect(() => {
    const build = () => {
      setDate(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) + " UTC");
      const main = document.getElementById("ed-main"), scope = main?.closest("[data-receipts]") ? main : null;
      if (!scope) { setNotes([]); return; }
      const links = [...scope.querySelectorAll<HTMLAnchorElement>("a[data-print]")].filter(a => !a.dataset["print"]!.includes("#")), f = footnotes(links.map(a => a.dataset["print"]!));
      links.forEach((a, k) => { a.dataset["fn"] = String(f.numbers[k]); });
      setNotes(f.notes);
    };
    build(); window.addEventListener("beforeprint", build);
    return () => window.removeEventListener("beforeprint", build);
  }, [path]);
  return <>
    {notes.length > 0 && <section className="print-only print-notes" aria-label="Link addresses"><h2 className="ed-kicker">Links</h2><ol>{notes.map(n => <li key={n.n} value={n.n}>{n.href}</li>)}</ol></section>}
    <p className="print-only print-foot" aria-hidden="true">{SITE_HOST}{printPath(path)}{date ? ` · printed ${date}` : ""}</p>
  </>;
}
