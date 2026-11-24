begin;

select plan(6);

select is(
  (
    select count(*)::bigint
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m','f')
      and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
      )
  ),
  0::bigint,
  'anon has no table/view privileges in public, including inherited PUBLIC grants'
);

select is(
  (
    select count(*)::bigint
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and (
        has_sequence_privilege('anon', c.oid, 'USAGE')
        or has_sequence_privilege('anon', c.oid, 'SELECT')
        or has_sequence_privilege('anon', c.oid, 'UPDATE')
      )
  ),
  0::bigint,
  'anon has no sequence privileges in public'
);

select ok(
  has_function_privilege('anon', 'public.get_public_condominium_branding(text)', 'EXECUTE'),
  'anon can execute the public branding RPC'
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
    where n.nspname in ('public', 'private')
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
