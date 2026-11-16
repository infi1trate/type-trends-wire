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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GATE_ENABLED } from "../lib/gate";
import { activeCss, fontLinks } from "../lib/theme";
import { modeOf } from "../lib/theme/route-mode";
import { densityOf } from "../lib/ia";
import { HEAD_SCRIPT } from "../lib/motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { BRAND_DESCRIPTION, BRAND_LINE, BRAND_NAME } from "@/lib/brand";
import { say } from "@/lib/voice";
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
  const density = useRouterState({ select: s => densityOf(s.matches[s.matches.length - 1]?.routeId ?? "/") });
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
