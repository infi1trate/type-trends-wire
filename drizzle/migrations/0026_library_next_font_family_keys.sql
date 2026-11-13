CREATE OR REPLACE FUNCTION public.library_history_family(s jsonb,r text,source text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE family text; stack jsonb; candidate text; prior text;
BEGIN
 family := s#>>ARRAY['type','rendered',r,'family'];
 IF source='wayback' AND (coalesce(public.library_number(s#>'{archive,fonts_failed}'),0)>0 OR s#>>ARRAY['type','rendered',r,'substituted']='true' OR coalesce(s#>>ARRAY['type','rendered',r,'webfont'],'false')<>'true') THEN
  stack := coalesce(s#>ARRAY['type','declared',r,'stack'],s#>ARRAY['type','declared',r,'family']);
  IF jsonb_typeof(stack)='string' THEN stack := to_jsonb(string_to_array(stack#>>'{}',',')); END IF;
  IF jsonb_typeof(stack)='array' THEN
   FOR candidate IN SELECT value FROM jsonb_array_elements_text(stack) LOOP
    candidate := btrim(candidate, E' \t\n\r"\'');
    IF candidate<>'' AND candidate !~* '_Fallback(_[0-9a-f]{5,8})?$' THEN family := candidate; EXIT; END IF;
   END LOOP;
  END IF;
 END IF;
 family := btrim(family, E' \t\n\r"\'');
 family := regexp_replace(family,'^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$','\1','i');
 family := regexp_replace(family,'([a-z])([A-Z])','\1 \2','g');
 family := regexp_replace(lower(family),'[^a-z0-9]','','g');
 LOOP prior := family; family := regexp_replace(family,'(webfont|variable|display|text|web|vf|pro)$',''); EXIT WHEN family IS NOT DISTINCT FROM prior; END LOOP;
 RETURN nullif(family,'');
END; $$;