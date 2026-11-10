create table public.gfont_snapshots (
  captured_on date not null,
  family text not null,
  category text not null,
  popularity_rank integer not null check (popularity_rank > 0),
  trending_rank integer not null check (trending_rank > 0),
  is_variable boolean not null default false,
  primary key (captured_on, family)
);
create index gfont_snapshots_family_idx on public.gfont_snapshots (family, captured_on);

create table public.wire_items (
  id bigint generated always as identity primary key,
  url text not null unique,
  title text not null,
  source text not null,
  source_kind text not null check (source_kind in ('rss','hn')),
  published_at timestamptz not null,
  excerpt text,
  tags text[] not null default '{}',
  fetched_at timestamptz not null default now()
);
create index wire_items_published_idx on public.wire_items (published_at desc);
create index wire_items_tags_idx on public.wire_items using gin (tags);

create table public.ingest_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  ok boolean not null,
  rows_written integer not null default 0,
  detail jsonb
);

grant select on public.gfont_snapshots to anon, authenticated;
grant select on public.wire_items to anon, authenticated;
grant select on public.ingest_runs to anon, authenticated;
grant all on public.gfont_snapshots to service_role;
grant all on public.wire_items to service_role;
grant all on public.ingest_runs to service_role;

alter table public.gfont_snapshots enable row level security;
alter table public.wire_items enable row level security;
alter table public.ingest_runs enable row level security;
create policy "public read" on public.gfont_snapshots for select to anon, authenticated using (true);
create policy "public read" on public.wire_items for select to anon, authenticated using (true);
create policy "public read ok runs" on public.ingest_runs for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.wire_items;