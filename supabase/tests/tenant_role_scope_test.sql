begin;

select plan(4);

select is(
  (
    select count(*)::bigint
    from pg_policies p
    where p.schemaname = 'public'
      and (coalesce(p.qual, '') like '%has_condo_role(%'
        or coalesce(p.with_check, '') like '%has_condo_role(%')
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = p.tablename
          and c.column_name = 'condominium_id'
      )
  ),
  0::bigint,
  'policies on condominium rows do not rely on a global cross-condominium role check'
);

select is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'guard_parking_listing',
        'guard_parking_request',
        'guard_portaria_inventory_update'
      ])
      and pg_get_functiondef(p.oid) like '%public.has_condo_role(%'
  ),
  0::bigint,
  'parking and concierge trigger functions do not use global role checks'
);

select is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'guard_parking_listing',
        'guard_parking_request',
        'guard_portaria_inventory_update'
      ])
      and pg_get_functiondef(p.oid) like '%public.has_condominium_role(%'
  ),
  3::bigint,
  'parking and concierge trigger functions verify roles in the row condominium'
);

select ok(
  position(
    'NEW.condominium_id IS DISTINCT FROM OLD.condominium_id'
    in pg_get_functiondef('public.guard_parking_listing()'::regprocedure)
  ) > 0
  and position(
    'NEW.condominium_id IS DISTINCT FROM OLD.condominium_id'
    in pg_get_functiondef('public.guard_portaria_inventory_update()'::regprocedure)
  ) > 0,
  'parking listings and bicycle inventory cannot be moved between condominium tenants'
);

select * from finish();
rollback;
