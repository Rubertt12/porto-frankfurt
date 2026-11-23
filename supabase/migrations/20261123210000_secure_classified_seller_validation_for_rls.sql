CREATE OR REPLACE FUNCTION private.is_valid_classified_seller(
  p_classified_id uuid,
  p_condominium_id uuid,
  p_seller_profile_id uuid,
  p_seller_apartment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.condominium_classifieds c
    JOIN public.apartment_residents seller_ar
      ON seller_ar.profile_id = c.seller_profile_id
     AND seller_ar.apartment_id = c.apartment_id
     AND seller_ar.condominium_id = c.condominium_id
    JOIN public.profiles seller_p
      ON seller_p.id = c.seller_profile_id
     AND seller_p.is_active = true
    JOIN public.resident_email_verifications seller_v
      ON seller_v.profile_id = c.seller_profile_id
     AND seller_v.condominium_id = c.condominium_id
     AND seller_v.verified_at IS NOT NULL
    WHERE c.id = p_classified_id
      AND c.condominium_id = p_condominium_id
      AND c.seller_profile_id = p_seller_profile_id
      AND c.apartment_id = p_seller_apartment_id
      AND c.status = 'available'
      AND c.seller_profile_id <> (SELECT auth.uid())
      AND seller_ar.move_out_date IS NULL
  );
$function$;

REVOKE ALL ON FUNCTION private.is_valid_classified_seller(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_valid_classified_seller(uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS classified_interests_insert_verified_resident ON public.classified_interests;

CREATE POLICY classified_interests_insert_verified_resident
ON public.classified_interests
FOR INSERT
TO authenticated
WITH CHECK (
  buyer_profile_id = (SELECT auth.uid())
  AND status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.profiles buyer_p
    WHERE buyer_p.id = (SELECT auth.uid())
      AND buyer_p.role = 'resident'::public.condo_role
      AND buyer_p.is_active = true
  )
  AND public.is_linked_to_apartment(buyer_apartment_id)
  AND EXISTS (
    SELECT 1
    FROM public.apartment_residents buyer_ar
    JOIN public.resident_email_verifications buyer_v
      ON buyer_v.profile_id = buyer_ar.profile_id
     AND buyer_v.condominium_id = buyer_ar.condominium_id
    WHERE buyer_ar.profile_id = (SELECT auth.uid())
      AND buyer_ar.apartment_id = classified_interests.buyer_apartment_id
      AND buyer_ar.condominium_id = classified_interests.condominium_id
      AND buyer_ar.move_out_date IS NULL
      AND buyer_v.verified_at IS NOT NULL
  )
  AND private.is_valid_classified_seller(
    classified_interests.classified_id,
    classified_interests.condominium_id,
    classified_interests.seller_profile_id,
    classified_interests.seller_apartment_id
  )
);
