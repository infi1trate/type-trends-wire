import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { READ_DEADLINE_MS, isReaderFn, within } from "./lib/deadline";
// C1 · attachSupabaseAuthLazy replaces the generated attachSupabaseAuth on purpose (same header, client loaded lazily; auth-attach.ts).
import { attachSupabaseAuthLazy } from "./lib/auth-attach";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// requestMiddleware runs on every request; functionMiddleware only on server functions, where
// client sendContext is unvalidated input. Append to these arrays, never replace them.
// Enabling Lovable Cloud adds functionMiddleware: [attachSupabaseAuth], the bearer token that
// requireSupabaseAuth server functions need. Add it by hand only if Lovable Cloud or a
// user-managed Supabase project is connected, no middleware here sets Authorization, and the
// project did not intentionally replace it.
// S1 · no page waits without limit: every reader GET server function (the public pages' reads and late blocks, by file; never the
// desk's or the jobs') answers or fails within READ_DEADLINE_MS. A late block that fails shows "could not load this part" with a retry,
// so a response always closes even when the database stops answering.
const readDeadline = createMiddleware({ type: "function" }).server(async ({ next, method, serverFnMeta }) =>
  isReaderFn(method, serverFnMeta?.filename) ? within(next(), READ_DEADLINE_MS, serverFnMeta?.name ?? "read") : next());

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuthLazy, readDeadline],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
