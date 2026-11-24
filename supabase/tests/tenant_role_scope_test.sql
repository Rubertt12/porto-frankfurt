begin;

select plan(1);

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

select * from finish();
rollback;
