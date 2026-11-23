#!/bin/bash
# D1 Part 1 · read how much the database writes, every 10 s, for N minutes (default 60), into a file (default /tmp/db-writes.tsv):
# time | write-log bytes (pg_stat_wal, real bytes, not the 16 MB file positions the 2-minute archive switch pads) | full-page images |
# temp-file bytes | blocks read from disk | rows inserted+updated+deleted per table. Read-only; uses the sandbox's psql settings.
# Attribute the deltas to jobs by lining their minutes up with job_runs start/finish rows.
mins=${1:-60}; out=${2:-/tmp/db-writes.tsv}; end=$((SECONDS + mins * 60))
while [ $SECONDS -lt $end ]; do
  psql -Atc "select to_char(clock_timestamp(),'HH24:MI:SS'), (select wal_bytes from pg_stat_wal), (select wal_fpi from pg_stat_wal),
    (select temp_bytes from pg_stat_database where datname=current_database()), (select blks_read from pg_stat_database where datname=current_database()),
    (select string_agg(relname||'='||(n_tup_ins+n_tup_upd+n_tup_del),',' order by relname) from pg_stat_user_tables where n_tup_ins+n_tup_upd+n_tup_del>0)" >> "$out"
  sleep 10
done
