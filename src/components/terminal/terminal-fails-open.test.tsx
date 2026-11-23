// Terminal fix (23 Nov): a read that fails or runs past its limit stays inside its own part. The ticker's library line disappears
// quietly, a panel shows one retry line, and the rest of the Terminal stays on screen; retry runs the failed read again.
import { describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import { PartBoundary } from "@/components/read/Later";

function Reads({ fn, label }: { fn: () => Promise<string>; label: string }) {
  const { data } = useSuspenseQuery({ queryKey: [label], queryFn: fn, retry: false });
  return <p>{data}</p>;
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const quietConsole = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("Terminal parts fail open", () => {
  // C1 · the part first tries once more by itself (1.2 s later); the retry line shows only when that fails too.
  it("a panel read that fails twice shows one retry line and leaves the bars around it", async () => {
    const spy = quietConsole();
    const fn = vi.fn().mockRejectedValueOnce(new Error("read_timeout: getLibrary took over 4000 ms")).mockRejectedValueOnce(new Error("read_timeout: again")).mockResolvedValue("300 brands");
    render(<QueryClientProvider client={client()}><header>TOP BAR</header><PartBoundary><Suspense fallback={<p>waiting</p>}><Reads fn={fn} label="lib" /></Suspense></PartBoundary><footer>FOOTER</footer></QueryClientProvider>);
    await screen.findByRole("status", undefined, { timeout: 3000 });
    expect(screen.getByText("TOP BAR")).toBeInTheDocument();
    expect(screen.getByText("FOOTER")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("300 brands")).toBeInTheDocument());
    expect(fn).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
  it("the ticker's quiet part draws nothing when its read fails, and its neighbours stay", async () => {
    const spy = quietConsole();
    render(<QueryClientProvider client={client()}><span>SIGNALS ON THE TICKER</span><PartBoundary quiet><Suspense fallback={null}><Reads fn={() => Promise.reject(new Error("read_timeout"))} label="tick" /></Suspense></PartBoundary></QueryClientProvider>);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.getByText("SIGNALS ON THE TICKER")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    spy.mockRestore();
  });
});
