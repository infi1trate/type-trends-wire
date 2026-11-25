// A4 · Read-view list keys, pure: which key does what. The terminal keeps its own keys (this runs only inside the Read shell).
export const KEY_PAGES = ["/", "/signals", "/brands", "/data"] as const;
export const GO_TO: Record<string, string> = { t: "/", s: "/signals", b: "/brands" };
export const KEY_HELP: [string, string][] = [["j / ↓", "Next row or card"], ["k / ↑", "Previous row or card"], ["Enter", "Open"], ["/", "Search or filter"], ["g then t", "Today"], ["g then s", "Signals"], ["g then b", "Brands"], ["?", "These keys"], ["Esc", "Close"]];
export type KeyIn = { key: string; typing: boolean; mod: boolean; inList: boolean; pendingG: boolean; path: string };
export type KeyAction = { do: "next" | "prev" | "search" | "help" | "close" | "g" } | { do: "go"; to: string } | null;
/** True while the reader is typing in a field: no key is taken then. */
export const isTyping = (el: { tagName?: string; isContentEditable?: boolean; type?: string } | null) => {
  if (!el?.tagName) return false;
  const t = el.tagName.toUpperCase();
  if (el.isContentEditable) return true;
  if (t === "TEXTAREA" || t === "SELECT") return true;
  return t === "INPUT" && !["checkbox", "radio", "button", "submit", "reset", "range"].includes((el.type ?? "text").toLowerCase());
};
export function keyAction(k: KeyIn): KeyAction {
  if (k.typing || k.mod) return null;
  if (k.pendingG) return GO_TO[k.key] ? { do: "go", to: GO_TO[k.key]! } : null;
  if (k.key === "?") return { do: "help" };
  if (k.key === "Escape") return { do: "close" };
  if (k.key === "g") return { do: "g" };
  const listPage = (KEY_PAGES as readonly string[]).includes(k.path);
  if (!listPage) return null;
  if (k.key === "j" || (k.inList && k.key === "ArrowDown")) return { do: "next" };
  if (k.key === "k" || (k.inList && k.key === "ArrowUp")) return { do: "prev" };
  // "/" stays with the shell's own search key (U3), so it is not bound twice.
  return null;
}
