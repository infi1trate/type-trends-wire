import { useRouter } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";

/** In-app link for computed hrefs ("/?panel=…", "/library/…"): client-side navigation, real href for new tabs. */
export function AppLink({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const router = useRouter();
  return <a href={href} {...rest} onClick={e => { onClick?.(e); if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !href.startsWith("/")) return; e.preventDefault(); void router.navigate({ href }); }} />;
}
