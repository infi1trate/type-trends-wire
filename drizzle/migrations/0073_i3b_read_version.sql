-- I3b · a read-version stamp on every AI read: a short hash of model + full vision request (prompt and label list) + image recipe
-- (src/lib/read-version.ts). Every read stored so far was made with the request in use since 11 Nov 21:45 UTC (the ten earlier calls
-- left no stored rows), so existing rows take that stamp through the column default, which writes no rows and fires no triggers;
-- the default is then dropped so later rows carry only the stamp the app writes, or null.
ALTER TABLE public.library_tags ADD COLUMN read_version text DEFAULT 'f43f51b4993c';
ALTER TABLE public.library_tags ALTER COLUMN read_version DROP DEFAULT;
COMMENT ON COLUMN public.library_tags.read_version IS 'Short hash of model + vision request (prompt, label list) + image recipe; null when unknown. See src/lib/read-version.ts.';