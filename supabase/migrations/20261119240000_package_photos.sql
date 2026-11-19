-- Photos captured by concierge at package intake; private and scoped to the destination unit.
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS photo_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('package-photos', 'package-photos', false, 8388608, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS package_photos_read ON storage.objects;
CREATE POLICY package_photos_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'package-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role,'security'::condo_role])
    OR is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
);

DROP POLICY IF EXISTS package_photos_insert ON storage.objects;
CREATE POLICY package_photos_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'package-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role,'concierge'::condo_role])
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(name))[1])::uuid
  )
);

DROP POLICY IF EXISTS package_photos_delete ON storage.objects;
CREATE POLICY package_photos_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'package-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
);
