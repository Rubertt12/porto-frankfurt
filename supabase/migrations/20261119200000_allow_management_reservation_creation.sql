-- Allow authorized condominium staff to create reservations for residents.
-- Residents remain restricted to reservations for apartments linked to their own profile.
DROP POLICY IF EXISTS reservations_insert_resident_or_management ON public.reservations;
CREATE POLICY reservations_insert_resident_or_management
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (
  (
    requested_by = auth.uid()
    AND is_linked_to_apartment(apartment_id)
  )
  OR has_condo_role(
    ARRAY['super_admin','syndic','administrator']::condo_role[]
  )
);
