CREATE OR REPLACE FUNCTION public.get_order_status(_order_id uuid)
RETURNS TABLE (
  order_id uuid,
  order_number bigint,
  status public.order_status,
  customer_name text,
  table_number text,
  total numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.status, o.customer_name, o.table_number,
         o.total, o.created_at, o.updated_at
  FROM public.orders o
  WHERE o.id = _order_id;
$$;

REVOKE ALL ON FUNCTION public.get_order_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_status(uuid) TO anon, authenticated;
