// C1 · the project's own copy of the generated bearer-token middleware (integrations/supabase/auth-attacher.ts), with the browser
// database client loaded on the first server-function call instead of statically: the generated file's static import put the client and
// its auth, storage and realtime libraries in front of every page's first byte on a cold server. Same behaviour: when the browser
// has a signed-in session, its access token goes on every server-function request.
import { createMiddleware } from "@tanstack/react-start";

export const attachSupabaseAuthLazy = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
