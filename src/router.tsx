import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  // S1 · a failed read is not retried behind a placeholder: the part shows "could not load this part" with its own "Try again" at once
  // (a read that passed its 4 s limit, or a part whose read failed while the page was built, arrives as an error the browser cannot
  // always tell apart, so none is retried silently). Grey placeholders therefore never outlast one read's limit in the browser.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
    // P1: pointing at, focusing or touching a link starts that page's reads (its critical read and its deferred parts), so most
    // clicks land on data already in hand.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Cut (brand motion): a page change wipes with a hard edge where the View Transitions API exists; search-only changes
    // (a format filter, a data-story step) never wipe. Where transition types are unsupported, the CSS leaves the change instant.
    defaultViewTransition: { types: ({ pathChanged }) => (pathChanged ? ["cut"] : false) },
  });

  // Hand the server's query results to the browser, so hydration renders the same data the server did instead of fetching it again
  // (a second fetch can land on another server instance or after a new story, and its different numbers broke hydration on /terminal).
  // The root route already provides the client, so the integration doesn't wrap it a second time.
  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: false });

  return router;
};
