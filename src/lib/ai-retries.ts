// T2 · D: how many times each kind of model call may be retried, in one place (pure). A structured-output failure (no answer in the
// fixed shape, or an answer that does not parse) gets at most one retry; a refusal gets none; a check failure (an answer that parses
// but breaks a writing rule) is not a structured-output failure and keeps the writer's plan. Unknown outcomes (the call may have run)
// are a separate matter: the library text worker re-queues them below three attempts after charging in full, as before.
export type RetryKind = "vision" | "pricing" | "changelog" | "product" | "brief" | "writer" | "desk" | "desk_vision" | "headline";
export type RetryRule = { structured: 0 | 1; refusal: 0; before: string };
export const RETRIES: Readonly<Record<RetryKind, RetryRule>> = {
  vision: { structured: 0, refusal: 0, before: "none in the site: a failed read answers the crawler with an error (the crawler's own resend is outside this code)" },
  pricing: { structured: 1, refusal: 0, before: "one correction retry with the validation errors; a refusal paused the worker" },
  changelog: { structured: 1, refusal: 0, before: "one correction retry with the validation errors; a refusal paused the worker" },
  product: { structured: 1, refusal: 0, before: "one correction retry with the validation errors; a refusal paused the worker" },
  brief: { structured: 1, refusal: 0, before: "two attempts in all on a missing call or a failed check; a refusal stopped it" },
  writer: { structured: 1, refusal: 0, before: "up to two retries (writer, writer again, then the text model) on any unusable answer, a refusal included" },
  desk: { structured: 0, refusal: 0, before: "none: one call, the rules' result stands when it fails" },
  desk_vision: { structured: 0, refusal: 0, before: "none: one call, the rules' result stands when it fails" },
  headline: { structured: 0, refusal: 0, before: "none: one call, the change is held for the desk when it fails" },
};
/** Calls allowed in all for a kind after structured-output failures: the first plus its retries. */
export const structuredAttempts = (k: RetryKind) => 1 + RETRIES[k].structured;
/** A writer's per-item guard for `tryModels`, kept out of the writer's rule file so the standards checklist fingerprint does not move:
 *  `call` wraps each model call and `open` gates the next one. After a refusal, or after the kind's structured-output attempts came back
 *  unusable (no answer, or one `parse` rejects), no further call is made for the item and its facts-built text stands. An answer that
 *  parses but breaks a writing rule is not counted, so the writer's plan still gets its corrected second try. */
export function retryGuard<T>(kind: RetryKind, parse: (raw: unknown) => T | null) {
  let unusable = 0, stopped = false;
  return {
    call: <R extends { raw: unknown; refused?: boolean } | null>(p: Promise<R>): Promise<R> => p.then(r => {
      if (r?.refused) stopped = true;
      else if (r && parse(r.raw) == null && ++unusable >= structuredAttempts(kind)) stopped = true;
      return r;
    }),
    open: () => !stopped,
  };
}
