CREATE OR REPLACE FUNCTION public.create_establishment_with_owner(
  _name text,
  _slug text,
  _address text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _business_category text DEFAULT NULL
) RETURNS public.establishments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _base text;
  _final text;
  _i int := 0;
  _row public.establishments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  _base := regexp_replace(lower(coalesce(nullif(trim(_slug), ''), _name)), '[^a-z0-9]+', '-', 'g');
  _base := trim(both '-' from _base);
  IF char_length(_base) < 2 THEN _base := 'cardapio'; END IF;
  _base := left(_base, 50);
  _final := _base;
  WHILE EXISTS (SELECT 1 FROM public.establishments e WHERE e.slug = _final) LOOP
    _i := _i + 1;
    _final := _base || '-' || _i::text;
  END LOOP;

  INSERT INTO public.establishments (owner_user_id, name, slug, address, phone, business_category)
  VALUES (_uid, _name, _final, _address, _phone, _business_category)
  RETURNING * INTO _row;

  INSERT INTO public.establishment_members (establishment_id, user_id, role)
  VALUES (_row.id, _uid, 'admin');

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_establishment_with_owner(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_establishment_with_owner(text, text, text, text, text) TO authenticated;