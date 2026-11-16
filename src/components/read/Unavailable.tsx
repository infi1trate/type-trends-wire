// The page a gallery or collection shows when its stored captures couldn't be read: the Patterns shell (not the Digest's), what happened
// in the house voice, and one Raised "Try again" that re-runs the read (a plain link to the same address without JavaScript).
import { useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { DigestShell } from "@/components/digest/Editorial";
import { UNAVAILABLE_BODY } from "@/lib/unavailable";

export function GalleryUnavailable({ title }: { title: string }) {
  const router = useRouter(), href = useRouterState({ select: s => s.location.href }), [busy, setBusy] = useState(false);
  const retry = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try { await router.invalidate(); } finally { setBusy(false); }
  };
  return <DigestShell label="Patterns" section="patterns">
    <section className="ed-wrap py-16 md:py-20" data-unavailable="">
      <p className="ed-kicker">Patterns</p>
      <h1 className="ed-cover mt-3" role="alert">{title}</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">{UNAVAILABLE_BODY}</p>
      <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <a href={href} onClick={retry} data-container="raised" className="c-raised" aria-busy={busy || undefined}>{busy ? "Trying again…" : "Try again"}</a>
        <Link to="/patterns" className="ed-tap ed-data">All patterns</Link>
        <Link to="/collections" className="ed-tap ed-data">Collections</Link>
      </p>
    </section>
  </DigestShell>;
}
