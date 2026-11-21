import { useRouter } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";
import { canonicalHref } from "@/lib/ia";

/** In-app link for computed hrefs ("/terminal?panel=…", "/library/…"): client-side navigation, real href for new tabs. */
export function AppLink({ href: raw, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  // U1: stored links to old object addresses render in their one-address form, so nothing depends on the redirect.
  const router = useRouter(), href = canonicalHref(raw);
  return <a href={href} {...rest} onClick={e => { onClick?.(e); if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !href.startsWith("/")) return; e.preventDefault(); void router.navigate({ href }); }} />;
}
