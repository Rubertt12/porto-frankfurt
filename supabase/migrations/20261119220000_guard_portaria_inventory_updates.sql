-- Limit concierge/security updates to operational availability fields.
-- Administrators retain full maintenance access through the existing RLS policy.
CREATE OR REPLACE FUNCTION public.guard_portaria_inventory_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF public.has_condo_role(ARRAY['concierge'::public.condo_role,'security'::public.condo_role])
     AND NOT public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role])
  THEN
    IF (to_jsonb(NEW) - ARRAY['status','updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','updated_at'])
    THEN
      RAISE EXCEPTION 'Portaria pode alterar somente a disponibilidade do item.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_bicycle_keys_portaria_update ON public.bicycle_keys;
CREATE TRIGGER guard_bicycle_keys_portaria_update
BEFORE UPDATE ON public.bicycle_keys
FOR EACH ROW EXECUTE FUNCTION public.guard_portaria_inventory_update();

DROP TRIGGER IF EXISTS guard_bicycle_assets_portaria_update ON public.bicycle_assets;
CREATE TRIGGER guard_bicycle_assets_portaria_update
BEFORE UPDATE ON public.bicycle_assets
FOR EACH ROW EXECUTE FUNCTION public.guard_portaria_inventory_update();

REVOKE ALL ON FUNCTION public.guard_portaria_inventory_update() FROM PUBLIC, anon;
