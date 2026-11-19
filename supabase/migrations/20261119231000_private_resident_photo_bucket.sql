-- Resident and pet photos contain personal data: require authenticated, unit-scoped reads.
UPDATE storage.buckets SET public = false WHERE id = 'resident-photos';

DROP POLICY IF EXISTS resident_photos_read ON storage.objects;
CREATE POLICY resident_photos_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    has_condo_role(ARRAY['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
    OR is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
);
