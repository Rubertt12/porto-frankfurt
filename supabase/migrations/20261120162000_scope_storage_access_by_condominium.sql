-- Remove broad storage policies that allowed staff in one condo to mutate files in another.
DROP POLICY IF EXISTS management_delete_private_files ON storage.objects;
DROP POLICY IF EXISTS management_update_private_files ON storage.objects;
DROP POLICY IF EXISTS staff_upload_private_files ON storage.objects;
DROP POLICY IF EXISTS private_files_read_authorized ON storage.objects;

-- Document uploads and deletes are scoped by the condominium UUID in folder 1.
DROP POLICY IF EXISTS condo_documents_admin_upload ON storage.objects;
CREATE POLICY condo_documents_admin_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'condo-documents'
  AND public.has_condominium_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
  )
);

DROP POLICY IF EXISTS condo_documents_admin_delete ON storage.objects;
CREATE POLICY condo_documents_admin_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'condo-documents'
  AND public.has_condominium_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
  )
);

-- Package photos: the role must belong to the condominium encoded in folder 1.
DROP POLICY IF EXISTS package_photos_insert ON storage.objects;
CREATE POLICY package_photos_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'package-photos'
  AND public.has_condominium_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'concierge'::public.condo_role]
  )
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(name))[1])::uuid
  )
);

DROP POLICY IF EXISTS package_photos_read ON storage.objects;
CREATE POLICY package_photos_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM public.packages p
    WHERE p.photo_path = objects.name
      AND public.can_access_condominium(p.condominium_id)
      AND (
        public.has_condominium_role(
          p.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'concierge'::public.condo_role,'security'::public.condo_role]
        )
        OR public.is_linked_to_apartment(p.apartment_id)
      )
  )
);

DROP POLICY IF EXISTS package_photos_delete ON storage.objects;
CREATE POLICY package_photos_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'package-photos'
  AND public.has_condominium_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
  )
);

-- Financial files: both the tenant and the role must match the path's condominium.
DROP POLICY IF EXISTS financial_files_admin_insert ON storage.objects;
CREATE POLICY financial_files_admin_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'condo-financial'
  AND public.has_condominium_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
  )
);

DROP POLICY IF EXISTS financial_files_admin_read ON storage.objects;
CREATE POLICY financial_files_admin_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'condo-financial'
  AND public.can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    public.has_condominium_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
    )
    OR EXISTS (
      SELECT 1 FROM public.financial_documents d
      WHERE d.storage_path = objects.name
        AND d.review_status = 'approved'
        AND public.is_linked_to_condominium(d.condominium_id)
    )
  )
);

DROP POLICY IF EXISTS financial_files_admin_delete ON storage.objects;
CREATE POLICY financial_files_admin_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'condo-financial'
  AND public.has_condominium_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
  )
);

-- Resident photos: require membership in the same condominium or link to the exact apartment.
DROP POLICY IF EXISTS resident_photos_upload ON storage.objects;
CREATE POLICY resident_photos_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resident-photos'
  AND (
    public.has_condominium_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
    )
    OR public.is_linked_to_apartment(((storage.foldername(name))[2])::uuid)
  )
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(name))[1])::uuid
  )
);

DROP POLICY IF EXISTS resident_photos_read ON storage.objects;
CREATE POLICY resident_photos_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(objects.name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(objects.name))[1])::uuid
      AND (
        public.has_condominium_role(
          a.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
        )
        OR public.is_linked_to_apartment(a.id)
      )
  )
);

DROP POLICY IF EXISTS resident_photos_update ON storage.objects;
CREATE POLICY resident_photos_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(objects.name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(objects.name))[1])::uuid
      AND (
        public.has_condominium_role(
          a.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
        )
        OR public.is_linked_to_apartment(a.id)
      )
  )
)
WITH CHECK (
  bucket_id = 'resident-photos'
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(objects.name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(objects.name))[1])::uuid
      AND (
        public.has_condominium_role(
          a.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
        )
        OR public.is_linked_to_apartment(a.id)
      )
  )
);

DROP POLICY IF EXISTS resident_photos_delete ON storage.objects;
CREATE POLICY resident_photos_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND EXISTS (
    SELECT 1 FROM public.apartments a
    WHERE a.id = ((storage.foldername(objects.name))[2])::uuid
      AND a.condominium_id = ((storage.foldername(objects.name))[1])::uuid
      AND (
        public.has_condominium_role(
          a.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
        )
        OR public.is_linked_to_apartment(a.id)
      )
  )
);

-- Read private files only when the matching database record grants access in the same tenant.
CREATE POLICY private_files_read_authorized ON storage.objects
FOR SELECT TO authenticated
USING (
  (bucket_id = 'condo-documents' AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = objects.name
      AND public.can_access_condominium(d.condominium_id)
      AND (
        public.has_condominium_role(
          d.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'concierge'::public.condo_role,'security'::public.condo_role]
        )
        OR (d.is_visible_to_residents = true AND (d.apartment_id IS NULL OR public.is_linked_to_apartment(d.apartment_id)))
      )
  ))
  OR (bucket_id = 'package-photos' AND EXISTS (
    SELECT 1 FROM public.packages p
    WHERE p.photo_path = objects.name
      AND public.can_access_condominium(p.condominium_id)
      AND (
        public.has_condominium_role(
          p.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'concierge'::public.condo_role,'security'::public.condo_role]
        )
        OR public.is_linked_to_apartment(p.apartment_id)
      )
  ))
  OR (bucket_id = 'occurrence-attachments' AND EXISTS (
    SELECT 1 FROM public.occurrences o
    WHERE objects.name = ANY(o.attachment_paths)
      AND public.can_access_condominium(o.condominium_id)
      AND (
        public.has_condominium_role(
          o.condominium_id,
          ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'security'::public.condo_role]
        )
        OR public.is_linked_to_apartment(o.apartment_id)
      )
  ))
);
