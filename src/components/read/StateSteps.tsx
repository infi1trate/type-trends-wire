// The next steps a voice entry offers (lib/voice.ts): a retry that re-runs the page's reads (a plain reload link without JavaScript),
// links, and waits spelled out in words. Used by every not-found, failed and empty page so they read and behave alike.
import { useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import type { Step } from "@/lib/voice";
import { line } from "@/lib/voice";

export function StateSteps({ steps, className = "ed-data mt-8 flex flex-wrap items-center gap-x-6 gap-y-4" }: { steps: readonly Step[]; className?: string }) {
  const router = useRouter(), href = useRouterState({ select: s => s.location.href }), [busy, setBusy] = useState(false);
  const retry = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try { await router.invalidate(); } finally { setBusy(false); }
  };
  if (!steps.length) return null;
  return <p className={className}>
    {steps.map((s, n) => "retry" in s
      ? <a key={n} href={href} onClick={retry} data-container="raised" className="c-raised" aria-busy={busy || undefined}>{busy ? line("busy.retry") : s.label}</a>
      : "href" in s ? <a key={n} href={s.href} className="ed-tap">{s.label}{n === 0 ? " →" : ""}</a>
      : <span key={n} className="ed-small">{s.label}</span>)}
  </p>;
}
