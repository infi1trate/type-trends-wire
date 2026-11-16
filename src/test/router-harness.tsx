// Renders a component inside a real TanStack router (memory history) and a query client, for page-level render tests.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { render, act } from "@testing-library/react";
import type { ReactNode } from "react";

export async function renderInRouter(node: () => ReactNode, path = "/", seed?: (qc: QueryClient) => void) {
  const root = createRootRoute({ component: () => <>{node()}</> });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: [path] }) });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false, staleTime: Infinity } } });
  seed?.(qc);
  let out!: ReturnType<typeof render>;
  await act(async () => { out = render(<QueryClientProvider client={qc}><RouterProvider router={router as never} /></QueryClientProvider>); await router.load(); });
  return out;
}
