begin;

select plan(6);

select is(
  (
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
  ),
  0::bigint,
  'anon has no direct table/view privileges in public'
);

select is(
  (
    select count(*)::bigint
    from information_schema.role_usage_grants
    where object_schema = 'public'
      and grantee = 'anon'
  ),
  0::bigint,
  'anon has no sequence usage privileges in public'
);

select ok(
  has_function_privilege('anon', 'public.get_public_condominium_branding(text)', 'EXECUTE'),
  'anon can execute only the public branding RPC'
);

select is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname <> 'get_public_condominium_branding'
  ),
  0::bigint,
  'anon cannot execute other public-schema functions'
);

select is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=""%'
  ),
  0::bigint,
  'all public SECURITY DEFINER functions pin an empty search_path'
);

select is(
  (
    select count(*)::bigint
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclnamespace = 'public'::regnamespace
      and a.grantee in (0, (select oid from pg_roles where rolname = 'anon'))
      and (
        (d.defaclobjtype = 'r' and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))
        or (d.defaclobjtype = 'S' and a.privilege_type in ('USAGE','SELECT','UPDATE'))
        or (d.defaclobjtype = 'f' and a.privilege_type = 'EXECUTE')
      )
  ),
  0::bigint,
  'future public objects do not grant privileges to PUBLIC or anon by default'
);

select * from finish();
rollback;
