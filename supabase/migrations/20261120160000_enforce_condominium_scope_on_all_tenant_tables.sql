-- Enforce condominium ownership on every tenant-owned table.
-- Staff members are validated through condominium_members; residents through apartment_residents.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables b
      ON b.table_schema=c.table_schema AND b.table_name=c.table_name
    WHERE c.table_schema='public'
      AND b.table_type='BASE TABLE'
      AND c.column_name='condominium_id'
      AND EXISTS (
        SELECT 1 FROM pg_class pc
        JOIN pg_namespace pn ON pn.oid=pc.relnamespace
        WHERE pn.nspname='public' AND pc.relname=c.table_name AND pc.relrowsecurity=true
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope_guard ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_scope_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_access_condominium(condominium_id) OR public.is_linked_to_condominium(condominium_id)) WITH CHECK (public.can_access_condominium(condominium_id) OR public.is_linked_to_condominium(condominium_id))',
      t.table_name
    );
  END LOOP;
END $$;

-- Resident-facing modules must recognize residents linked through their apartment.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'community_posts',
    'community_comments',
    'community_reactions',
    'community_reports',
    'parking_listings',
    'parking_requests',
    'resident_requests'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND policyname='tenant_isolation'
    ) THEN
      EXECUTE format('DROP POLICY tenant_isolation ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_access_condominium(condominium_id) OR public.is_linked_to_condominium(condominium_id)) WITH CHECK (public.can_access_condominium(condominium_id) OR public.is_linked_to_condominium(condominium_id))',
        t
      );
    END IF;
  END LOOP;
END $$;
