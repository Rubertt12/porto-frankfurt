-- Residents may view photos within their own apartment, but must not be able
-- to replace or delete another resident's profile/family/pet photo.
-- The app uploads with upsert:false and does not update Storage objects.
DROP POLICY IF EXISTS resident_photos_update ON storage.objects;

DROP POLICY IF EXISTS resident_photos_delete ON storage.objects;
CREATE POLICY resident_photos_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND EXISTS (
    SELECT 1
    FROM public.apartments a
    WHERE a.id = ((storage.foldername(objects.name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(objects.name))[1])::uuid
      AND (
        public.has_condominium_role(
          a.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
        )
        OR (
          objects.owner_id = (SELECT auth.uid())::text
          AND public.is_linked_to_apartment(a.id)
        )
      )
  )
);
