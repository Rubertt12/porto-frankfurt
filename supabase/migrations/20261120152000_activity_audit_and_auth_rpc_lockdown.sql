-- Restrict the auth.users trigger helper from the public RPC surface.
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM anon, authenticated;

-- Metadata-only audit events: record changed field names, never row values or PII.
CREATE OR REPLACE FUNCTION public.log_condominium_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_row jsonb;
  v_condominium_id uuid;
  v_entity_id text;
  v_changed text[];
BEGIN
  v_row := COALESCE(v_new, v_old);
  v_condominium_id := NULLIF(v_row->>'condominium_id', '')::uuid;
  v_entity_id := COALESCE(v_new->>'id', v_old->>'id');

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
      INTO v_changed
      FROM pg_catalog.jsonb_object_keys(v_new) AS fields(key)
     WHERE key NOT IN ('id','created_at','updated_at','condominium_id','cpf','rg','document_last4','notes');
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
      INTO v_changed
      FROM pg_catalog.jsonb_object_keys(v_old) AS fields(key)
     WHERE key NOT IN ('id','created_at','updated_at','condominium_id','cpf','rg','document_last4','notes');
  ELSE
    SELECT COALESCE(array_agg(n.key ORDER BY n.key), ARRAY[]::text[])
      INTO v_changed
      FROM pg_catalog.jsonb_each(v_new) AS n(key, value)
      FULL JOIN pg_catalog.jsonb_each(v_old) AS o(key, value) USING (key)
     WHERE n.value IS DISTINCT FROM o.value
       AND n.key NOT IN ('id','created_at','updated_at','condominium_id','cpf','rg','document_last4','notes');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, details, condominium_id)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    pg_catalog.jsonb_build_object('changed_fields', pg_catalog.to_jsonb(v_changed)),
    v_condominium_id
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.log_condominium_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_condominium_activity() FROM anon, authenticated;

DROP TRIGGER IF EXISTS audit_packages_changes ON public.packages;
CREATE TRIGGER audit_packages_changes AFTER INSERT OR UPDATE OR DELETE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_visitor_logs_changes ON public.visitor_logs;
CREATE TRIGGER audit_visitor_logs_changes AFTER INSERT OR UPDATE OR DELETE ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_reservations_changes ON public.reservations;
CREATE TRIGGER audit_reservations_changes AFTER INSERT OR UPDATE OR DELETE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_occurrences_changes ON public.occurrences;
CREATE TRIGGER audit_occurrences_changes AFTER INSERT OR UPDATE OR DELETE ON public.occurrences FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_announcements_changes ON public.announcements;
CREATE TRIGGER audit_announcements_changes AFTER INSERT OR UPDATE OR DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_documents_changes ON public.documents;
CREATE TRIGGER audit_documents_changes AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_financial_transactions_changes ON public.financial_transactions;
CREATE TRIGGER audit_financial_transactions_changes AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_vehicles_changes ON public.vehicles;
CREATE TRIGGER audit_vehicles_changes AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_parking_spaces_changes ON public.parking_spaces;
CREATE TRIGGER audit_parking_spaces_changes AFTER INSERT OR UPDATE OR DELETE ON public.parking_spaces FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_common_areas_changes ON public.common_areas;
CREATE TRIGGER audit_common_areas_changes AFTER INSERT OR UPDATE OR DELETE ON public.common_areas FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_apartment_residents_changes ON public.apartment_residents;
CREATE TRIGGER audit_apartment_residents_changes AFTER INSERT OR UPDATE OR DELETE ON public.apartment_residents FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_authorized_visitors_changes ON public.authorized_visitors;
CREATE TRIGGER audit_authorized_visitors_changes AFTER INSERT OR UPDATE OR DELETE ON public.authorized_visitors FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_resident_requests_changes ON public.resident_requests;
CREATE TRIGGER audit_resident_requests_changes AFTER INSERT OR UPDATE OR DELETE ON public.resident_requests FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_resident_notifications_changes ON public.resident_notifications;
CREATE TRIGGER audit_resident_notifications_changes AFTER INSERT OR UPDATE OR DELETE ON public.resident_notifications FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_bicycle_assets_changes ON public.bicycle_assets;
CREATE TRIGGER audit_bicycle_assets_changes AFTER INSERT OR UPDATE OR DELETE ON public.bicycle_assets FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_bicycle_keys_changes ON public.bicycle_keys;
CREATE TRIGGER audit_bicycle_keys_changes AFTER INSERT OR UPDATE OR DELETE ON public.bicycle_keys FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
DROP TRIGGER IF EXISTS audit_bicycle_movements_changes ON public.bicycle_key_movements;
CREATE TRIGGER audit_bicycle_movements_changes AFTER INSERT OR UPDATE OR DELETE ON public.bicycle_key_movements FOR EACH ROW EXECUTE FUNCTION public.log_condominium_activity();
