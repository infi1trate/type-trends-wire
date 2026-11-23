// C1 · a late part whose read fails (or runs past the reader limit) tries once more by itself after 1.2 s, keeping its placeholder; only a
// second failure shows the failed line. The brand page's card is such a part: the 23 Nov fault (a page of 118 words, no headings) came
// from one failed card read taking the whole page with it.
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import { Later, LATER_RETRY_MS } from "./Later";

vi.mock("@/lib/read.functions", async orig => { const w = () => new Promise<never>(() => {}); return { ...(await orig<object>()), getBrandMoves: w, getBrandSections: w, getBrandSector: w, getBrandSimilar: w, getBrandStories: w, getBrandSurfaces: w }; });
import { BrandPageWithoutCard } from "./BrandView";
import { renderInRouter } from "@/test/router-harness";

function Reads({ fn }: { fn: () => Promise<string> }) {
  const { data } = useSuspenseQuery({ queryKey: ["card"], queryFn: fn, retry: false });
  return <p>{data}</p>;
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const timeout = (n: number) => () => Promise.reject(new Error(`read_timeout: getBrandCard took over 4000 ms (${n})`));

describe("a late part's one quiet try again", () => {
  it("waits 1.2 s", () => expect(LATER_RETRY_MS).toBe(1200));
  it("fails once: keeps its placeholder, asks again by itself and shows the content, with no failed line ever drawn", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fn = vi.fn().mockImplementationOnce(timeout(1)).mockResolvedValue("Netlify · Dev tools");
    const { container } = render(<QueryClientProvider client={client()}><Later id="brand-card-later" shapes={[{ kind: "block", height: 96 }]}><Reads fn={fn} /></Later></QueryClientProvider>);
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await act(async () => { await new Promise(r => setTimeout(r, 300)); });
    expect(container.querySelector("[data-later][aria-busy='true'] [data-placeholder]")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    await screen.findByText("Netlify · Dev tools", undefined, { timeout: 3000 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).toBeNull();
    expect(spy.mock.calls.some(c => c[0] === "deferred section failed")).toBe(false);
    spy.mockRestore();
  });
  it("fails twice: shows the one failed line with its retry", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fn = vi.fn().mockImplementationOnce(timeout(1)).mockImplementationOnce(timeout(2)).mockResolvedValue("late");
    render(<QueryClientProvider client={client()}><Later shapes={[{ kind: "block", height: 96 }]}><Reads fn={fn} /></Later></QueryClientProvider>);
    await screen.findByRole("status", undefined, { timeout: 3000 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button")).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("the brand page when its card fails twice", () => {
  it("keeps the brand's name, one failed line in the card's place and every part that doesn't need the card", async () => {
    const { container } = await renderInRouter(() => <BrandPageWithoutCard domain="netlify.com" name="Netlify" line={<p role="status">Didn't arrive this time.</p>} />, "/brands/netlify.com");
    expect(container.querySelector("h1")?.textContent).toBe("Netlify");
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(container.querySelector("#ed-moves")).not.toBeNull();
    const headings = [...container.querySelectorAll("h2, h3")].map(h => h.textContent);
    for (const t of ["Moves", "Sections", "Similar brands", "Stories about this brand"]) expect(headings.some(h => h?.includes(t))).toBe(true);
  });
});
