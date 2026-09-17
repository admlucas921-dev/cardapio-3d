CREATE TYPE public.order_status AS ENUM ('new', 'preparing', 'ready', 'completed', 'cancelled');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_number bigint GENERATED ALWAYS AS IDENTITY,
  customer_name text NOT NULL,
  table_number text,
  notes text,
  status public.order_status NOT NULL DEFAULT 'new',
  total numeric(10,2) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_customer_name_len CHECK (char_length(customer_name) BETWEEN 2 AND 80)
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_kitchen ON public.orders(establishment_id, status, created_at DESC);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.orders, public.order_items TO service_role;

CREATE POLICY "members view orders" ON public.orders FOR SELECT TO authenticated
USING (public.is_establishment_member(establishment_id));
CREATE POLICY "members update orders" ON public.orders FOR UPDATE TO authenticated
USING (public.is_establishment_member(establishment_id))
WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members view order items" ON public.order_items FOR SELECT TO authenticated
USING (public.is_establishment_member(establishment_id));

CREATE OR REPLACE FUNCTION public.place_order(
  _establishment_id uuid,
  _customer_name text,
  _table_number text,
  _notes text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order_id uuid;
  _total numeric(10,2);
  _requested_count integer;
  _valid_count integer;
BEGIN
  IF char_length(trim(coalesce(_customer_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Nome do cliente inválido';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item';
  END IF;

  SELECT count(*) INTO _requested_count FROM jsonb_array_elements(_items);
  SELECT count(*), coalesce(sum(p.price * greatest(1, least(99, (item->>'quantity')::integer))), 0)
    INTO _valid_count, _total
  FROM jsonb_array_elements(_items) item
  JOIN public.products p ON p.id = (item->>'product_id')::uuid
  WHERE p.establishment_id = _establishment_id AND p.available = true;

  IF _valid_count <> _requested_count THEN RAISE EXCEPTION 'Há itens inválidos no pedido'; END IF;

  INSERT INTO public.orders (establishment_id, customer_name, table_number, notes, total)
  VALUES (_establishment_id, trim(_customer_name), nullif(trim(_table_number), ''), nullif(trim(_notes), ''), _total)
  RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, establishment_id, product_id, product_name, quantity, unit_price)
  SELECT _order_id, _establishment_id, p.id, p.name,
    greatest(1, least(99, (item->>'quantity')::integer)), p.price
  FROM jsonb_array_elements(_items) item
  JOIN public.products p ON p.id = (item->>'product_id')::uuid
  WHERE p.establishment_id = _establishment_id AND p.available = true;

  RETURN _order_id;
END; $$;

REVOKE ALL ON FUNCTION public.place_order(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, text, text, jsonb) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
