CREATE TABLE public.staff_secrets (id smallint PRIMARY KEY CHECK (id = 1), secret_sha256 text NOT NULL, set_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.staff_secrets TO service_role;
ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;