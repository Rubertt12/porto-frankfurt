-- Scope every row-level policy that currently relies on the global
-- has_condo_role() helper to the condominium represented by that row.
-- A user can belong to multiple condominiums; being an administrator in one
-- must never grant staff permissions in another where they are only a resident.

DO $$
DECLARE
  policy_row record;
  using_expression text;
  check_expression text;
  role_list text;
  statement text;
BEGIN
  FOR policy_row IN
    SELECT p.schemaname, p.tablename, p.policyname, p.permissive, p.cmd,
           p.roles, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (coalesce(p.qual, '') LIKE '%has_condo_role(%'
        OR coalesce(p.with_check, '') LIKE '%has_condo_role(%')
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = p.tablename
          AND c.column_name = 'condominium_id'
      )
    ORDER BY p.tablename, p.policyname
  LOOP
    using_expression := CASE
      WHEN policy_row.qual IS NULL THEN NULL
      ELSE replace(policy_row.qual, 'has_condo_role(', 'public.has_condominium_role(condominium_id, ')
    END;
    check_expression := CASE
      WHEN policy_row.with_check IS NULL THEN NULL
      ELSE replace(policy_row.with_check, 'has_condo_role(', 'public.has_condominium_role(condominium_id, ')
    END;

    SELECT string_agg(quote_ident(role_name), ', ' ORDER BY role_name)
      INTO role_list
    FROM unnest(policy_row.roles) AS roles(role_name);

    EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, policy_row.tablename);

    statement := format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      policy_row.policyname,
      policy_row.tablename,
      policy_row.permissive,
      policy_row.cmd,
      role_list
    );

    IF using_expression IS NOT NULL THEN
      statement := statement || format(' USING (%s)', using_expression);
    END IF;
    IF check_expression IS NOT NULL THEN
      statement := statement || format(' WITH CHECK (%s)', check_expression);
    END IF;

    EXECUTE statement;
  END LOOP;
END
$$;


-- Trigger functions must use the role in the row's own condominium too.
CREATE OR REPLACE FUNCTION public.guard_parking_listing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  is_manager boolean;
  apartment_condominium uuid;
  space_condominium uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.condominium_id IS DISTINCT FROM OLD.condominium_id THEN
      RAISE EXCEPTION 'O anúncio não pode ser transferido para outro condomínio.';
    END IF;
    is_manager := public.has_condominium_role(
      OLD.condominium_id,
      ARRAY['super_admin','syndic','administrator']::public.condo_role[]
    );
  ELSE
    is_manager := public.has_condominium_role(
      NEW.condominium_id,
      ARRAY['super_admin','syndic','administrator']::public.condo_role[]
    );
  END IF;

  SELECT a.condominium_id INTO apartment_condominium
  FROM public.apartments a
  WHERE a.id = NEW.apartment_id;

  SELECT s.condominium_id INTO space_condominium
  FROM public.parking_spaces s
  WHERE s.id = NEW.parking_space_id
    AND s.apartment_id = NEW.apartment_id
    AND s.is_active = true;

  IF apartment_condominium IS DISTINCT FROM NEW.condominium_id
    OR space_condominium IS DISTINCT FROM NEW.condominium_id
  THEN
    RAISE EXCEPTION 'A vaga e o apartamento precisam pertencer ao mesmo condomínio do anúncio.';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT is_manager THEN
    IF NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id
      OR NEW.apartment_id IS DISTINCT FROM OLD.apartment_id
      OR NEW.parking_space_id IS DISTINCT FROM OLD.parking_space_id
    THEN
      RAISE EXCEPTION 'Não é permitido transferir a titularidade ou trocar a vaga do anúncio.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
    AND NEW.owner_profile_id IS DISTINCT FROM (SELECT auth.uid())
    AND NOT is_manager
  THEN
    RAISE EXCEPTION 'O anunciante deve ser o usuário autenticado.';
  END IF;

  IF NOT is_manager AND NOT public.is_linked_to_apartment(NEW.apartment_id) THEN
    RAISE EXCEPTION 'Você não possui vínculo ativo com este apartamento.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_parking_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  listing public.parking_listings%rowtype;
  is_manager boolean;
  apartment_condominium uuid;
BEGIN
  SELECT * INTO listing
  FROM public.parking_listings
  WHERE id = NEW.listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anúncio de vaga não encontrado.';
  END IF;

  IF NEW.condominium_id IS DISTINCT FROM listing.condominium_id THEN
    RAISE EXCEPTION 'A solicitação e o anúncio precisam pertencer ao mesmo condomínio.';
  END IF;

  SELECT a.condominium_id INTO apartment_condominium
  FROM public.apartments a
  WHERE a.id = NEW.apartment_id;

  IF apartment_condominium IS DISTINCT FROM listing.condominium_id THEN
    RAISE EXCEPTION 'O apartamento informado não pertence ao condomínio do anúncio.';
  END IF;

  is_manager := public.has_condominium_role(
    listing.condominium_id,
    ARRAY['super_admin','syndic','administrator']::public.condo_role[]
  );

  IF TG_OP = 'INSERT' THEN
    IF NEW.requester_profile_id IS DISTINCT FROM (SELECT auth.uid())
      OR NOT public.is_linked_to_apartment(NEW.apartment_id)
    THEN
      RAISE EXCEPTION 'Solicitação deve pertencer ao morador autenticado e a um apartamento vinculado.';
    END IF;

    IF listing.status <> 'active' OR listing.owner_profile_id = NEW.requester_profile_id THEN
      RAISE EXCEPTION 'Este anúncio não está disponível para sua solicitação.';
    END IF;

    IF NEW.starts_on < listing.available_from
      OR (listing.available_until IS NOT NULL AND NEW.ends_on > listing.available_until)
    THEN
      RAISE EXCEPTION 'O período solicitado está fora da disponibilidade anunciada.';
    END IF;
  ELSE
    IF NEW.condominium_id IS DISTINCT FROM OLD.condominium_id
      OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
      OR NEW.requester_profile_id IS DISTINCT FROM OLD.requester_profile_id
      OR NEW.apartment_id IS DISTINCT FROM OLD.apartment_id
      OR NEW.starts_on IS DISTINCT FROM OLD.starts_on
      OR NEW.ends_on IS DISTINCT FROM OLD.ends_on
    THEN
      RAISE EXCEPTION 'Os dados originais da solicitação não podem ser alterados.';
    END IF;

    IF NOT is_manager THEN
      IF OLD.requester_profile_id = (SELECT auth.uid()) THEN
        IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('pending','approved') THEN
          RAISE EXCEPTION 'O solicitante só pode cancelar uma solicitação pendente ou aprovada.';
        END IF;
      ELSIF listing.owner_profile_id = (SELECT auth.uid()) THEN
        IF NEW.status NOT IN ('approved','rejected','completed')
          OR OLD.status NOT IN ('pending','approved')
        THEN
          RAISE EXCEPTION 'O responsável pela vaga pode aprovar, recusar ou concluir a solicitação.';
        END IF;
      ELSE
        RAISE EXCEPTION 'Sem permissão para alterar esta solicitação.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_portaria_inventory_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.condominium_id IS DISTINCT FROM OLD.condominium_id THEN
    RAISE EXCEPTION 'O item não pode ser transferido para outro condomínio.';
  END IF;

  IF public.has_condominium_role(
       OLD.condominium_id,
       ARRAY['concierge'::public.condo_role,'security'::public.condo_role]
     )
     AND NOT public.has_condominium_role(
       OLD.condominium_id,
       ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role]
     )
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
$function$;
