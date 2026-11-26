-- R2b part 1 · applied as drizzle/migrations/0106_forecast_runs_panel.sql. Additive only; nothing backfilled.
ALTER TABLE public.forecast_runs ADD COLUMN IF NOT EXISTS panel_size integer;
ALTER TABLE public.forecast_runs ADD COLUMN IF NOT EXISTS panel_step_id bigint;
COMMENT ON COLUMN public.forecast_runs.panel_size IS 'R2b: brands in the panel (active, panel_since set) when the run computed; null on runs before R2b read as 300.';
COMMENT ON COLUMN public.forecast_runs.panel_step_id IS 'R2b: id of the latest panel_steps row when the run computed; null = no step yet.';
