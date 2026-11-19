-- Scoped resident documents, household self-service, bicycle inventory and key custody.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS apartment_id uuid REFERENCES public.apartments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS reference_month text,
  ADD COLUMN IF NOT EXISTS document_number text;
CREATE INDEX IF NOT EXISTS documents_apartment_created_idx ON public.documents (apartment_id, created_at DESC);

-- Replace the broad tenant policy with apartment-aware document access.
DROP POLICY IF EXISTS tenant_isolation ON public.documents;
DROP POLICY IF EXISTS documents_manage ON public.documents;
CREATE POLICY documents_manage ON public.documents FOR ALL TO authenticated
USING (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role]))
WITH CHECK (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role]));
DROP POLICY IF EXISTS documents_read_visible_or_staff ON public.documents;
CREATE POLICY documents_read_visible_or_staff ON public.documents FOR SELECT TO authenticated
USING (
  can_access_condominium(condominium_id)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR (is_visible_to_residents = true AND (apartment_id IS NULL OR is_linked_to_apartment(apartment_id)))
  )
);

-- Residents may maintain their own private contact/complementary data only.
DROP POLICY IF EXISTS resident_private_data_self_manage ON public.resident_private_data;
CREATE POLICY resident_private_data_self_manage ON public.resident_private_data FOR ALL TO authenticated
USING (profile_id = (SELECT auth.uid()))
WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.bicycle_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  key_code text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','inactive')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (condominium_id, key_code)
);
CREATE TABLE IF NOT EXISTS public.bicycle_key_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  bicycle_key_id uuid NOT NULL REFERENCES public.bicycle_keys(id) ON DELETE RESTRICT,
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE RESTRICT,
  issued_to_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_to_name text NOT NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  returned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  returned_at timestamptz,
  notes text,
  CHECK (returned_at IS NULL OR returned_at >= issued_at)
);
CREATE INDEX IF NOT EXISTS bicycle_key_movements_unit_idx ON public.bicycle_key_movements (apartment_id, issued_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bicycle_key_one_open_movement_idx ON public.bicycle_key_movements (bicycle_key_id) WHERE returned_at IS NULL;
ALTER TABLE public.bicycle_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bicycle_key_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bicycle_keys_staff_manage ON public.bicycle_keys;
CREATE POLICY bicycle_keys_staff_manage ON public.bicycle_keys FOR ALL TO authenticated
USING (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role,'security'::condo_role]))
WITH CHECK (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role,'security'::condo_role]));
DROP POLICY IF EXISTS bicycle_key_movements_staff_manage ON public.bicycle_key_movements;
CREATE POLICY bicycle_key_movements_staff_manage ON public.bicycle_key_movements FOR ALL TO authenticated
USING (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role,'security'::condo_role]))
WITH CHECK (
  can_access_condominium(condominium_id)
  AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role,'security'::condo_role])
  AND EXISTS (SELECT 1 FROM public.bicycle_keys k WHERE k.id = bicycle_key_id AND k.condominium_id = bicycle_key_movements.condominium_id)
  AND EXISTS (SELECT 1 FROM public.apartments a WHERE a.id = apartment_id AND a.condominium_id = bicycle_key_movements.condominium_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bicycle_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bicycle_key_movements TO authenticated;

-- Keep key status synchronized with issue/return events in the database.
CREATE OR REPLACE FUNCTION public.sync_bicycle_key_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.bicycle_keys SET status = 'in_use', updated_at = now() WHERE id = NEW.bicycle_key_id;
  ELSIF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE public.bicycle_keys SET status = 'available', updated_at = now() WHERE id = NEW.bicycle_key_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_bicycle_key_status_after_movement ON public.bicycle_key_movements;
CREATE TRIGGER sync_bicycle_key_status_after_movement
AFTER INSERT OR UPDATE OF returned_at ON public.bicycle_key_movements
FOR EACH ROW EXECUTE FUNCTION public.sync_bicycle_key_status();

-- Individual bicycle inventory; concierge/security can change operational status.
CREATE TABLE IF NOT EXISTS public.bicycle_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  apartment_id uuid REFERENCES public.apartments(id) ON DELETE SET NULL,
  asset_code text NOT NULL,
  description text,
  brand text,
  model text,
  color text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','inactive')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (condominium_id, asset_code)
);
CREATE INDEX IF NOT EXISTS bicycle_assets_condo_status_idx ON public.bicycle_assets (condominium_id, status);
ALTER TABLE public.bicycle_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bicycle_assets_staff_read ON public.bicycle_assets;
CREATE POLICY bicycle_assets_staff_read ON public.bicycle_assets FOR SELECT TO authenticated
USING (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role,'security'::condo_role]));
DROP POLICY IF EXISTS bicycle_assets_admin_manage ON public.bicycle_assets;
CREATE POLICY bicycle_assets_admin_manage ON public.bicycle_assets FOR ALL TO authenticated
USING (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role]))
WITH CHECK (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role]));
DROP POLICY IF EXISTS bicycle_assets_portaria_update ON public.bicycle_assets;
CREATE POLICY bicycle_assets_portaria_update ON public.bicycle_assets FOR UPDATE TO authenticated
USING (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['concierge'::condo_role,'security'::condo_role]))
WITH CHECK (can_access_condominium(condominium_id) AND has_condo_role(ARRAY['concierge'::condo_role,'security'::condo_role]));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bicycle_assets TO authenticated;

-- Private Storage: path is condominium UUID / apartment UUID or shared / filename.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('condo-documents','condo-documents',false,52428800,ARRAY['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=52428800,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS condo_documents_admin_upload ON storage.objects;
CREATE POLICY condo_documents_admin_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='condo-documents' AND split_part(name,'/',1) ~* '^[0-9a-f-]{36}$' AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role]) AND can_access_condominium(split_part(name,'/',1)::uuid));
DROP POLICY IF EXISTS condo_documents_scoped_read ON storage.objects;
CREATE POLICY condo_documents_scoped_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='condo-documents' AND split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
  AND can_access_condominium(split_part(name,'/',1)::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR split_part(name,'/',2)='shared'
    OR (split_part(name,'/',2) ~* '^[0-9a-f-]{36}$' AND is_linked_to_apartment(split_part(name,'/',2)::uuid))
  )
);
DROP POLICY IF EXISTS condo_documents_admin_delete ON storage.objects;
CREATE POLICY condo_documents_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='condo-documents' AND split_part(name,'/',1) ~* '^[0-9a-f-]{36}$' AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role]) AND can_access_condominium(split_part(name,'/',1)::uuid));
