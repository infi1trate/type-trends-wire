// COLLECTIONS: /collections (the numbered list) and /collections/<slug> (one saved filter as a wall). Live only with at least
// COLLECTION_MIN tiles on stored data; drafts say why. Each pairs with a data story or signal, and the data story links back.
import { Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { collectionQuery, collectionsQuery } from "@/lib/data";
import { COLLECTION_MIN } from "@/lib/collections/registry";
import { DigestShell } from "@/components/digest/Editorial";
import { Ledger } from "@/components/brand/Ledger";
import { Raised } from "@/components/brand/Containers";
import { Receipt } from "./StoryCard";
import { PagedWall } from "./Wall";
import { ReadFooter } from "./Bits";

const no = (n: number) => String(n).padStart(2, "0");
export function CollectionsIndexView() {
  const { data } = useSuspenseQuery(collectionsQuery());
  const live = data.filter(c => c.status === "live"), drafts = data.filter(c => c.status === "draft");
  return <DigestShell label="Collections" section="patterns" lens={false}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Patterns · Collections</p>
      <h1 className="ed-cover mt-3">Collections</h1>
      <p className="ed-standfirst mt-5 max-w-[62ch]">Saved views of the pattern gallery, each a numbered wall of stored captures. One goes live once at least {COLLECTION_MIN} captures match it.</p>
    </header>
    <section aria-labelledby="c-live" className="ed-wrap mt-10">
      <h2 id="c-live" className="ed-h3">{live.length} live</h2>
      {live.length ? <Ledger className="mt-3" label="Live collections" rows={live.map(c => ({ key: c.slug, href: c.href!, number: no(c.number), title: c.title, line: c.deck, facts: [`${c.count} captures`] }))} />
        : <p className="ed-body mt-3">No collection has {COLLECTION_MIN} matching captures yet. They go live on their own as captures arrive.</p>}
    </section>
    {drafts.length > 0 && <section aria-labelledby="c-drafts" className="ed-wrap mt-12">
      <h2 id="c-drafts" className="ed-h3">In preparation</h2>
      <Ledger className="mt-3" label="Draft collections" rows={drafts.map(c => ({ key: c.slug, href: `/collections/${c.slug}`, number: no(c.number), title: c.title, line: c.reason ?? "", facts: [`${c.count} of ${COLLECTION_MIN}`] }))} />
    </section>}
    <p className="ed-wrap ed-data mt-10"><Link to="/patterns" className="ed-tap">The whole gallery →</Link></p>
    <ReadFooter terminal="/terminal?panel=patterns" />
  </DigestShell>;
}

export function CollectionView({ slug, page }: { slug: string; page: number }) {
  const { data: c } = useSuspenseQuery(collectionQuery(slug, page));
  const qc = useQueryClient();
  if (c.kind === "missing") return null;
  return <DigestShell label={c.title} section="patterns" lens={false}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Collection No. {c.number}{c.kind === "draft" ? " · draft" : ""}</p>
      <h1 className="ed-cover mt-3">{c.title}</h1>
      <p className="ed-standfirst mt-5 max-w-[62ch]">{c.deck}</p>
      <p className="ed-data mt-4">Pairs with <Receipt href={c.pairs.href} className="ed-tap underline">{c.pairs.label} →</Receipt></p>
    </header>
    <section aria-label="Captures" className="ed-wrap mt-8">
      {c.kind === "draft" ? <div className="max-w-[60ch]"><p className="ed-body" role="status">Not live yet. {c.reason}</p><div className="mt-6"><Raised href="/collections">Every collection →</Raised></div></div>
        : <PagedWall key={slug} tiles={c.gallery.tiles} total={c.gallery.total} page={c.gallery.page} pages={c.gallery.pages} label={c.title}
          hrefFor={n => `/collections/${slug}${n > 1 ? `?page=${n}` : ""}`}
          fetchPage={async n => { const r = await qc.fetchQuery(collectionQuery(slug, n)); return r.kind === "live" ? r.gallery.tiles : []; }} />}
    </section>
    <p className="ed-wrap ed-data mt-10 flex flex-wrap gap-x-6"><Link to="/collections" className="ed-tap">Every collection →</Link><Link to="/patterns" className="ed-tap">The whole gallery →</Link></p>
    <ReadFooter terminal="/terminal?panel=patterns" />
  </DigestShell>;
}
