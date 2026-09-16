-- ============ tables ============
CREATE TABLE public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  address text,
  phone text,
  business_category text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishments_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 60),
  CONSTRAINT establishments_name_len CHECK (char_length(name) BETWEEN 2 AND 120)
);

CREATE TYPE public.member_role AS ENUM ('admin', 'attendant');

CREATE TABLE public.establishment_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, user_id)
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  tags text[] NOT NULL DEFAULT '{}',
  real_width_cm numeric(6,2) CHECK (real_width_cm IS NULL OR real_width_cm > 0),
  real_height_cm numeric(6,2) CHECK (real_height_cm IS NULL OR real_height_cm > 0),
  real_depth_cm numeric(6,2) CHECK (real_depth_cm IS NULL OR real_depth_cm > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_name_len CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE TYPE public.media_type AS ENUM ('image', 'video_360', 'model_3d');

CREATE TABLE public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_type public.media_type NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_establishment ON public.establishment_members(establishment_id);
CREATE INDEX idx_members_user ON public.establishment_members(user_id);
CREATE INDEX idx_categories_establishment ON public.categories(establishment_id, sort_order);
CREATE INDEX idx_products_establishment ON public.products(establishment_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_media_establishment ON public.product_media(establishment_id);
CREATE INDEX idx_media_product ON public.product_media(product_id, sort_order);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_establishments_updated BEFORE UPDATE ON public.establishments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ membership helper ============
CREATE OR REPLACE FUNCTION public.is_establishment_member(_establishment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_members m
    WHERE m.establishment_id = _establishment_id AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.establishments e
    WHERE e.id = _establishment_id AND e.owner_user_id = auth.uid()
  );
$$;

-- ============ grants ============
GRANT SELECT ON public.establishments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishments TO authenticated;
GRANT ALL ON public.establishments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_members TO authenticated;
GRANT ALL ON public.establishment_members TO service_role;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT SELECT ON public.product_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;

GRANT EXECUTE ON FUNCTION public.is_establishment_member(uuid) TO anon, authenticated;

-- ============ RLS ============
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- establishments
CREATE POLICY "public can view establishments" ON public.establishments
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner can create own establishment" ON public.establishments
FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "members can update establishment" ON public.establishments
FOR UPDATE TO authenticated USING (public.is_establishment_member(id)) WITH CHECK (public.is_establishment_member(id));
CREATE POLICY "owner can delete establishment" ON public.establishments
FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

-- members
CREATE POLICY "members can view team" ON public.establishment_members
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_establishment_member(establishment_id));
CREATE POLICY "owner can add members" ON public.establishment_members
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.owner_user_id = auth.uid())
);
CREATE POLICY "owner can update members" ON public.establishment_members
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.owner_user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.owner_user_id = auth.uid())
);
CREATE POLICY "owner can remove members" ON public.establishment_members
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.owner_user_id = auth.uid())
);

-- categories
CREATE POLICY "public can view visible categories" ON public.categories
FOR SELECT TO anon USING (visible = true);
CREATE POLICY "members can view categories" ON public.categories
FOR SELECT TO authenticated USING (visible = true OR public.is_establishment_member(establishment_id));
CREATE POLICY "members manage categories insert" ON public.categories
FOR INSERT TO authenticated WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members manage categories update" ON public.categories
FOR UPDATE TO authenticated USING (public.is_establishment_member(establishment_id)) WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members manage categories delete" ON public.categories
FOR DELETE TO authenticated USING (public.is_establishment_member(establishment_id));

-- products
CREATE POLICY "public can view available products" ON public.products
FOR SELECT TO anon USING (available = true);
CREATE POLICY "members can view products" ON public.products
FOR SELECT TO authenticated USING (available = true OR public.is_establishment_member(establishment_id));
CREATE POLICY "members manage products insert" ON public.products
FOR INSERT TO authenticated WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members manage products update" ON public.products
FOR UPDATE TO authenticated USING (public.is_establishment_member(establishment_id)) WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members manage products delete" ON public.products
FOR DELETE TO authenticated USING (public.is_establishment_member(establishment_id));

-- product media
CREATE POLICY "public can view media of available products" ON public.product_media
FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.available = true)
);
CREATE POLICY "members can view media" ON public.product_media
FOR SELECT TO authenticated USING (
  public.is_establishment_member(establishment_id)
  OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.available = true)
);
CREATE POLICY "members manage media insert" ON public.product_media
FOR INSERT TO authenticated WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members manage media update" ON public.product_media
FOR UPDATE TO authenticated USING (public.is_establishment_member(establishment_id)) WITH CHECK (public.is_establishment_member(establishment_id));
CREATE POLICY "members manage media delete" ON public.product_media
FOR DELETE TO authenticated USING (public.is_establishment_member(establishment_id));

-- ============ storage policies (bucket created separately) ============
CREATE POLICY "public read menu media" ON storage.objects
FOR SELECT TO anon, authenticated USING (bucket_id = 'menu-media');
CREATE POLICY "members upload menu media" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'menu-media'
  AND public.is_establishment_member(NULLIF((storage.foldername(name))[1], '')::uuid)
);
CREATE POLICY "members update menu media" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'menu-media'
  AND public.is_establishment_member(NULLIF((storage.foldername(name))[1], '')::uuid)
);
CREATE POLICY "members delete menu media" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'menu-media'
  AND public.is_establishment_member(NULLIF((storage.foldername(name))[1], '')::uuid)
);