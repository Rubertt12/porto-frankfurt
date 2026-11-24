-- Enforce active condominium membership for every classified-marketplace record.
-- These tables use participant-specific permissive policies; this restrictive policy
-- adds a tenant boundary that applies to every operation.

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'condominium_classifieds',
    'classified_interests',
    'classified_conversations',
    'classified_messages',
    'classified_reports'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS classified_tenant_scope_guard ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY classified_tenant_scope_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_access_condominium(condominium_id) OR public.is_linked_to_condominium(condominium_id)) WITH CHECK (public.can_access_condominium(condominium_id) OR public.is_linked_to_condominium(condominium_id))',
      target_table
    );
  END LOOP;
END
$$;

-- Residents may change the interest status, but must not be able to rewrite
-- the listing, condominium, participants, apartments, message, or creation time.
CREATE OR REPLACE FUNCTION private.guard_classified_interest_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.condominium_id IS DISTINCT FROM OLD.condominium_id
    OR NEW.classified_id IS DISTINCT FROM OLD.classified_id
    OR NEW.buyer_profile_id IS DISTINCT FROM OLD.buyer_profile_id
    OR NEW.seller_profile_id IS DISTINCT FROM OLD.seller_profile_id
    OR NEW.buyer_apartment_id IS DISTINCT FROM OLD.buyer_apartment_id
    OR NEW.seller_apartment_id IS DISTINCT FROM OLD.seller_apartment_id
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Os dados de origem do interesse não podem ser alterados.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_classified_interest_immutable_fields() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS classified_interests_immutable_fields ON public.classified_interests;
CREATE TRIGGER classified_interests_immutable_fields
BEFORE UPDATE ON public.classified_interests
FOR EACH ROW
EXECUTE FUNCTION private.guard_classified_interest_immutable_fields();


-- Message rows are append-only in the current application. The previous
-- participant UPDATE policy let either participant rewrite sender_profile_id
-- and impersonate the other party. No frontend workflow updates messages.
DROP POLICY IF EXISTS classified_messages_update_participants ON public.classified_messages;


-- Classified listing ownership and tenant identity must not be mutable by the seller.
-- Otherwise a seller linked to multiple condominiums could move a listing between
-- tenant scopes or change the displayed seller identity.
CREATE OR REPLACE FUNCTION private.guard_classified_listing_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.condominium_id IS DISTINCT FROM OLD.condominium_id
    OR NEW.apartment_id IS DISTINCT FROM OLD.apartment_id
    OR NEW.seller_profile_id IS DISTINCT FROM OLD.seller_profile_id
    OR NEW.seller_name IS DISTINCT FROM OLD.seller_name
    OR NEW.seller_unit_label IS DISTINCT FROM OLD.seller_unit_label
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'A identidade e o condomínio do anúncio não podem ser alterados.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_classified_listing_identity() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS classified_listing_identity_guard ON public.condominium_classifieds;
CREATE TRIGGER classified_listing_identity_guard
BEFORE UPDATE ON public.condominium_classifieds
FOR EACH ROW
EXECUTE FUNCTION private.guard_classified_listing_identity();

-- The application uploads classified images with upsert:false and never updates
-- storage object metadata. Removing UPDATE prevents moving an existing object
-- to another condominium folder where that tenant could then read it.
DROP POLICY IF EXISTS classifieds_storage_update_owner ON storage.objects;
