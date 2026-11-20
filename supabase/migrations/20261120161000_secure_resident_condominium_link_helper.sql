CREATE OR REPLACE FUNCTION public.is_linked_to_condominium(target_condominium uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.is_linked_to_condominium(target_condominium);
$function$;

REVOKE ALL ON FUNCTION public.is_linked_to_condominium(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_linked_to_condominium(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_linked_to_condominium(uuid) TO authenticated;
