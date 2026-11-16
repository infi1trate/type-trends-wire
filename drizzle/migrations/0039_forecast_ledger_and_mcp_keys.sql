-- Forecast ledger: one immutable row per recorded call. Never pruned, never deleted; only the resolution fields may be filled in once.
CREATE TABLE public.forecast_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL,
  week text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  made_at timestamptz NOT NULL,
  trait text NOT NULL CHECK (char_length(trait) BETWEEN 3 AND 120),
  scope text NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 40),
  origin text NOT NULL CHECK (origin IN ('weekly', 'alert')),
  selected_by text[] NOT NULL CHECK (cardinality(selected_by) BETWEEN 1 AND 3),
  stage_at_call text,
  share_at_call double precision,
  momentum double precision,
  next_wave_score double precision,
  direction text CHECK (direction IN ('up', 'down', 'flat')),
  band_lo double precision,
  band_mid double precision,
  band_hi double precision,
  horizon_q smallint,
  target_quarter text CHECK (target_quarter ~ '^\d{4}Q[1-4]$'),
  data_through text,
  backfilled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  actual_share double precision,
  actual_n integer,
  outcome text CHECK (outcome IN ('hit', 'miss', 'void')),
  outcome_reason text CHECK (char_length(outcome_reason) <= 300),
  CONSTRAINT forecast_calls_first_stands UNIQUE (week, trait, scope),
  CONSTRAINT forecast_calls_resolution CHECK ((outcome IS NULL) = (resolved_at IS NULL))
);
CREATE INDEX forecast_calls_made_at ON public.forecast_calls (made_at DESC, id DESC);
CREATE INDEX forecast_calls_trait ON public.forecast_calls (trait, scope);
CREATE INDEX forecast_calls_open ON public.forecast_calls (target_quarter) WHERE outcome IS NULL;
GRANT SELECT ON public.forecast_calls TO anon, authenticated;
GRANT ALL ON public.forecast_calls TO service_role;
ALTER TABLE public.forecast_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read the forecast ledger" ON public.forecast_calls FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.forecast_calls IS 'Append-only forecast ledger. The first call stored for (week, trait, scope) stands; call fields are immutable and a resolution can be written exactly once.';

CREATE OR REPLACE FUNCTION public.forecast_calls_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'forecast_calls is append-only'; END IF;
  IF OLD.outcome IS NOT NULL THEN RAISE EXCEPTION 'resolved calls are immutable'; END IF;
  IF (NEW.run_id, NEW.week, NEW.made_at, NEW.trait, NEW.scope, NEW.origin, NEW.selected_by, NEW.stage_at_call, NEW.share_at_call, NEW.momentum, NEW.next_wave_score,
      NEW.direction, NEW.band_lo, NEW.band_mid, NEW.band_hi, NEW.horizon_q, NEW.target_quarter, NEW.data_through, NEW.backfilled, NEW.created_at)
     IS DISTINCT FROM
     (OLD.run_id, OLD.week, OLD.made_at, OLD.trait, OLD.scope, OLD.origin, OLD.selected_by, OLD.stage_at_call, OLD.share_at_call, OLD.momentum, OLD.next_wave_score,
      OLD.direction, OLD.band_lo, OLD.band_mid, OLD.band_hi, OLD.horizon_q, OLD.target_quarter, OLD.data_through, OLD.backfilled, OLD.created_at)
  THEN RAISE EXCEPTION 'call fields are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER forecast_calls_no_rewrite BEFORE UPDATE ON public.forecast_calls FOR EACH ROW EXECUTE FUNCTION public.forecast_calls_guard();
CREATE TRIGGER forecast_calls_no_delete BEFORE DELETE ON public.forecast_calls FOR EACH ROW EXECUTE FUNCTION public.forecast_calls_guard();
CREATE TRIGGER forecast_calls_no_truncate BEFORE TRUNCATE ON public.forecast_calls FOR EACH STATEMENT EXECUTE FUNCTION public.forecast_calls_guard();

-- MCP keys: owner-issued, only the SHA-256 of the key is stored. Service role only (no anonymous or signed-in access).
CREATE TABLE public.mcp_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  key_sha256 text NOT NULL UNIQUE CHECK (key_sha256 ~ '^[0-9a-f]{64}$'),
  prefix text NOT NULL CHECK (prefix ~ '^dsgn_[A-Za-z0-9]{3}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  rate_per_min integer NOT NULL DEFAULT 600 CHECK (rate_per_min BETWEEN 1 AND 6000),
  note text CHECK (char_length(note) <= 300)
);
GRANT ALL ON public.mcp_keys TO service_role;
ALTER TABLE public.mcp_keys ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.mcp_keys IS 'Owner-issued MCP keys (dsgn_ + 32 base62). Plaintext is shown once at creation and never stored.';

CREATE TABLE public.mcp_key_usage (
  key_id uuid NOT NULL REFERENCES public.mcp_keys(id) ON DELETE CASCADE,
  day date NOT NULL,
  tool text NOT NULL CHECK (tool ~ '^[a-z_/]{1,40}$'),
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (key_id, day, tool)
);
GRANT ALL ON public.mcp_key_usage TO service_role;
ALTER TABLE public.mcp_key_usage ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.mcp_key_usage IS 'Aggregate MCP calls per key, day and tool. No request bodies.';

CREATE OR REPLACE FUNCTION public.mcp_key_count(p_key uuid, p_tool text) RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.mcp_key_usage (key_id, day, tool, calls) VALUES (p_key, (now() AT TIME ZONE 'utc')::date, p_tool, 1)
  ON CONFLICT (key_id, day, tool) DO UPDATE SET calls = public.mcp_key_usage.calls + 1;
  UPDATE public.mcp_keys SET last_used_at = now() WHERE id = p_key AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute');
$$;
REVOKE ALL ON FUNCTION public.mcp_key_count(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_key_count(uuid, text) TO service_role;