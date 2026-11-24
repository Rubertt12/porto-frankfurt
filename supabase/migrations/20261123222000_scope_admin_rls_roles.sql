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
