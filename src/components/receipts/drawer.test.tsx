// U2 · the receipt drawer: opening sets ?receipt= (history push), Back and Esc close it, a deep link opens it, focus returns to the opener.
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { ReceiptDrawer } from "./ReceiptDrawer";
import { useReceiptNav } from "./open";
import type { ReceiptModel } from "@/lib/views/receipts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const R = "share:css:subgrid";
const MODEL: ReceiptModel = { type: "share", kicker: "SIGNAL · SHARE BY QUARTER", title: "Subgrid layouts", lines: ["Latest well-covered quarter 2026Q4: 26.0% of N = 300 homepages (coverage 100%)."], tables: [{ caption: "Share by quarter", head: ["Quarter", "Share", "N", "Coverage", "Used"], rows: [["2026Q4", "26.0%", "300", "100%", "yes"]] }], full: "/signals/css%3Asubgrid?view=data" };

function Page() {
  const nav = useReceiptNav();
  return createElement("main", { tabIndex: -1 }, createElement("button", { type: "button", "data-opener": "", onClick: (e: { currentTarget: HTMLElement }) => nav.open(R, e.currentTarget) }, "26%"), createElement(ReceiptDrawer));
}
let root: Root | null = null, host: HTMLElement | null = null;
async function mount(url: string) {
  window.history.replaceState(null, "", url);
  const qc = new QueryClient(); qc.setQueryData(["receipt", R], MODEL);
  const router = createRouter({ routeTree: createRootRoute({ component: Page }), history: createBrowserHistory() });
  await router.load();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root!.render(createElement(QueryClientProvider, { client: qc }, createElement(RouterProvider, { router } as never))); });
  return router;
}
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
const drawer = () => document.querySelector("[data-receipt-drawer]");
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; });

describe("receipt drawer", () => {
  it("opens in place with ?receipt=, shows the receipt and its full Data link; Back closes it and focus returns", async () => {
    const router = await mount("/stories/x");
    const opener = document.querySelector<HTMLButtonElement>("[data-opener]")!;
    opener.focus();
    await act(async () => { opener.click(); }); await settle();
    expect(router.state.location.pathname).toBe("/stories/x");
    expect(new URL(window.location.href).searchParams.get("receipt")).toBe(R);
    expect(drawer()?.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(drawer()?.textContent).toContain("Subgrid layouts");
    expect(drawer()?.querySelector("[data-receipt-full]")?.getAttribute("href")).toBe("/signals/css%3Asubgrid?view=data");
    expect(document.activeElement?.textContent).toBe("CLOSE ✕");
    await act(async () => { window.history.back(); }); await settle();
    expect(drawer()).toBeNull();
    expect(window.location.search).toBe("");
    expect(document.activeElement).toBe(document.querySelector("[data-opener]"));
  });
  it("Esc closes it", async () => {
    await mount("/stories/x");
    const opener = document.querySelector<HTMLButtonElement>("[data-opener]")!;
    await act(async () => { opener.click(); }); await settle();
    expect(drawer()).not.toBeNull();
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); await settle();
    expect(drawer()).toBeNull();
  });
  it("a shared link opens the page with the drawer open; closing drops the parameter in place", async () => {
    await mount(`/stories/x?receipt=${encodeURIComponent(R)}`);
    await settle();
    expect(drawer()).not.toBeNull();
    await act(async () => { document.querySelector<HTMLButtonElement>("[data-receipt-drawer] [role=dialog] button")!.click(); }); await settle();
    expect(drawer()).toBeNull();
    expect(window.location.pathname).toBe("/stories/x");
    expect(window.location.search).toBe("");
  });
  it("is not drawn over a Data view", async () => {
    await mount(`/stories/x?view=data&receipt=${encodeURIComponent(R)}`);
    await settle();
    expect(drawer()).toBeNull();
  });
});
