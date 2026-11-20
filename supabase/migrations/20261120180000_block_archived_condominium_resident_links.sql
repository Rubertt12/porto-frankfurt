CREATE OR REPLACE FUNCTION private.is_linked_to_condominium(target_condominium uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.apartment_residents ar
    JOIN public.apartments a ON a.id = ar.apartment_id
    JOIN public.condominiums c ON c.id = ar.condominium_id
    WHERE ar.profile_id = (SELECT auth.uid())
      AND ar.condominium_id = target_condominium
      AND a.condominium_id = target_condominium
      AND c.status IN ('active', 'trial')
      AND (ar.move_out_date IS NULL OR ar.move_out_date >= CURRENT_DATE)
  );
$function$;
