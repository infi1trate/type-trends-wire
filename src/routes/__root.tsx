import { line as voiced } from "@/lib/voice";
import { ReceiptDrawer } from "@/components/receipts/ReceiptDrawer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  useHydrated,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GATE_ENABLED } from "../lib/gate";
import { activeCss, fontLinks } from "../lib/theme";
import { isDataMatch, modeOf } from "../lib/theme/route-mode";
import { densityOf } from "../lib/ia";
import { HEAD_SCRIPT } from "../lib/motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { BRAND_DESCRIPTION, BRAND_LINE, BRAND_NAME } from "@/lib/brand";
import { say } from "@/lib/voice";
import { FOCUS_TARGETS, laterFocus, shouldMoveFocus } from "@/lib/route-focus";
import { NotFoundLookup } from "@/components/read/NotFoundLookup";

function ErrorPage({ code, title, line, children }: { code: string; title: string; line: string; children: ReactNode }) {
  // Error pages take the theme: paper, the drawn mark, one Raised button (and a plain link beside it).
  return (
    <div className="digest flex min-h-screen flex-col">
      <header className="c-slab"><div className="ed-wrap flex min-h-14 items-center"><a href="/" aria-label={`${BRAND_NAME}, the front page`} className="inline-flex min-h-11 items-center"><Wordmark height={24} ground="ink" decorative /></a></div></header>
      <main className="ed-wrap flex-1 pb-24 pt-[104px]">
        <p className="ed-kicker">{code}</p>
        <h1 className="ed-h1 mt-4 max-w-[16ch]">{title}</h1>
        <p className="ed-standfirst mt-6">{line}</p>
        <div className="mt-10 flex flex-wrap items-center gap-6">{children}</div>
      </main>
    </div>
  );
}

function NotFoundComponent() {
  const v = say("site.notFound");
  return <ErrorPage code="Error 404" title={v.title} line={v.text}>
    <Link to="/" className="c-raised" data-container="raised">Go to the front page</Link>
    <NotFoundLookup />
  </ErrorPage>;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter(), hydrated = useHydrated();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  // Offline is only knowable in the browser; the server render (and a connected browser) shows the plain failed page.
  const v = say(hydrated && typeof navigator !== "undefined" && navigator.onLine === false ? "site.offline" : "site.failed");
  return <ErrorPage code={v.kind === "offline" ? "Offline" : "Didn't load"} title={v.title} line={v.text}>
    <button type="button" className="c-raised" data-container="raised" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
    <a href="/" className="ed-data ed-tap underline">Go to the front page</a>
  </ErrorPage>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND_NAME} — ${BRAND_LINE}` },
      { name: "description", content: BRAND_DESCRIPTION },
      { name: "author", content: "Brandon Forant" },
      { property: "og:title", content: `${BRAND_NAME} — ${BRAND_LINE}` },
      { property: "og:description", content: BRAND_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(GATE_ENABLED ? [{ name: "robots", content: "noindex" }] : []),
          ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/brand/files/slug-favicon-180.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      ...fontLinks("base"),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // The route sets the mode (light Read pages, dark terminal); the active theme's tokens are written once, here.
  const mode = useRouterState({ select: s => modeOf(s.matches) });
  // The page's density (Quiet, Steady, Loud) is recorded per route in ia.ts; the shell reads it here.
  // A Data view (U1) is terminal density: Loud.
  const density = useRouterState({ select: s => { const last = s.matches[s.matches.length - 1]; return last && isDataMatch(last) ? "loud" : densityOf(last?.routeId ?? "/"); } });
  return (
    // The head script may add data-arrive / data-save-data to <html> before hydration; the markup itself never depends on them.
    <html lang="en" data-mode={mode} data-density={density} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
        <style id="tk-theme" dangerouslySetInnerHTML={{ __html: activeCss() }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** After a client-side page change, focus goes to the new page's h1 (see route-focus.ts). */
function RouteFocus() {
  const router = useRouter();
  useEffect(() => router.subscribe("onResolved", e => {
    if (!shouldMoveFocus(e.fromLocation, { pathname: e.toLocation.pathname, hash: e.toLocation.hash })) return;
    window.requestAnimationFrame(() => {
      const el = FOCUS_TARGETS.map(s => document.querySelector<HTMLElement>(s)).find(Boolean);
      if (!el) return;
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
      laterFocus.pending = !!el.closest('[aria-busy="true"]');
    });
  }), [router]);
  return null;
}

/** S1 · while a page change is in flight, a thin line at the very top (fixed, so nothing moves) from 80 ms in; reduced motion: a still line. */
function NavProgress() {
  const busy = useRouterState({ select: s => s.status === "pending" || s.isLoading });
  return busy ? <div className="nav-progress" role="progressbar" aria-label={voiced("root.navProgress")} data-nav-progress="" /> : null;
}

/** D1 Part 5 · a page sent as its last good copy (the database slow or down) carries the copy's time in a head tag; one quiet line says
 *  so, fixed at the bottom so nothing moves, drawn after hydration only. */
function CopyAge() {
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => { setAt(document.querySelector('meta[name="slug-copy-at"]')?.getAttribute("content") ?? null); }, []);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const d = new Date(at), time = `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.toISOString().slice(11, 16)}`;
  return <p className="copy-age" role="status" data-copy-age="">{voiced("root.copyAge", { time })}</p>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* U2 · the receipt drawer, over any Read page whose address carries ?receipt= (drawn after hydration only). */}
      <ReceiptDrawer />
      <RouteFocus />
      <NavProgress />
      <CopyAge />
    </QueryClientProvider>
  );
}
