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
  });

  // Hand the server's query results to the browser, so hydration renders the same data the server did instead of fetching it again
  // (a second fetch can land on another server instance or after a new story, and its different numbers broke hydration on /terminal).
  // The root route already provides the client, so the integration doesn't wrap it a second time.
  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: false });

  return router;
};
