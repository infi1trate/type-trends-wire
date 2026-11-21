// U2 · opening and closing the receipt drawer: `?receipt=<type>:<id>` on the current address, pushed onto history so Back closes it.
// The element that opened it is remembered so focus returns there on close. Client-only.
import { createContext, useCallback, useContext } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ReceiptCtx } from "@/lib/views/receipts";

/** Where a receipt link sits (a story's facts know the story and its changes), so `receiptFor` can name the right receipt. */
export const ReceiptContext = createContext<ReceiptCtx>({});
export const useReceiptCtx = () => useContext(ReceiptContext);

let opener: HTMLElement | null = null, pushed = false;
export const takeOpener = () => { const o = opener; opener = null; return o; };
const withReceipt = (r: string | null) => {
  const u = new URL(window.location.href);
  if (r) u.searchParams.set("receipt", r); else u.searchParams.delete("receipt");
  return `${u.pathname}${u.search}${u.hash}`;
};
export function useReceiptNav() {
  const router = useRouter();
  const open = useCallback((r: string, from: HTMLElement | null) => {
    opener = from; pushed = true;
    void router.navigate({ href: withReceipt(r), resetScroll: false });
  }, [router]);
  const close = useCallback(() => {
    // Opened here: step back (the page behind keeps its place). A deep link: drop the parameter in place.
    if (pushed) { pushed = false; window.history.back(); return; }
    void router.navigate({ href: withReceipt(null), replace: true, resetScroll: false });
  }, [router]);
  return { open, close };
}
