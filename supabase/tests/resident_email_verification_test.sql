begin;

select plan(4);

select ok(
  not has_column_privilege('authenticated','public.resident_email_verifications','token','SELECT')
  and not has_column_privilege('authenticated','public.resident_email_verifications','email','SELECT')
  and not has_column_privilege('authenticated','public.resident_email_verifications','created_at','SELECT'),
  'authenticated users cannot read resident verification tokens, emails, or internal timestamps'
);

select ok(
  has_column_privilege('authenticated','public.resident_email_verifications','id','SELECT')
  and has_column_privilege('authenticated','public.resident_email_verifications','condominium_id','SELECT')
  and has_column_privilege('authenticated','public.resident_email_verifications','profile_id','SELECT')
  and has_column_privilege('authenticated','public.resident_email_verifications','verified_at','SELECT')
  and not has_table_privilege('authenticated','public.resident_email_verifications','SELECT'),
  'authenticated users can read only the non-secret verification status columns'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'resident_email_verifications'
      and policyname = 'resident_email_verifications_admin_select'
      and cmd = 'SELECT'
      and qual like '%condominium_id%'
  ),
  'condominium administrators can read verification status only within their own condominium'
);


select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'resident_email_verifications'
      and column_name = 'expires_at'
      and is_nullable = 'NO'
  )
  and position(
    'expires_at > now()'
    in pg_get_functiondef('public.confirm_resident_email(uuid)'::regprocedure)
  ) > 0,
  'resident email verification tokens expire after 24 hours'
);

select * from finish();
rollback;
