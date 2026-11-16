import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
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
