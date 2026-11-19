-- Individual photos for account holders, household residents and pets.
ALTER TABLE public.unit_family_members
  ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.unit_pets
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Public read is intentional for avatar rendering in the resident directory;
-- uploads remain restricted to authenticated members of the matching unit/condominium.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resident-photos',
  'resident-photos',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS resident_photos_upload ON storage.objects;
CREATE POLICY resident_photos_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resident-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
);

DROP POLICY IF EXISTS resident_photos_update ON storage.objects;
CREATE POLICY resident_photos_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'resident-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
);

DROP POLICY IF EXISTS resident_photos_delete ON storage.objects;
CREATE POLICY resident_photos_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
);
