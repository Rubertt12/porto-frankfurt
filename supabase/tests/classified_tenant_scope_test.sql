begin;

select plan(6);

select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'condominium_classifieds',
        'classified_interests',
        'classified_conversations',
        'classified_messages',
        'classified_reports'
      ])
      and policyname = 'classified_tenant_scope_guard'
      and permissive = 'RESTRICTIVE'
      and cmd = 'ALL'
      and roles @> array['authenticated']::name[]
      and qual like '%can_access_condominium%'
      and qual like '%is_linked_to_condominium%'
      and with_check like '%can_access_condominium%'
      and with_check like '%is_linked_to_condominium%'
  ),
  5::bigint,
  'all classified tables have restrictive tenant guards for every operation'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'classified_interests'
      and t.tgname = 'classified_interests_immutable_fields'
      and not t.tgisinternal
  ),
  'classified interest identity fields are protected by a before-update trigger'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'guard_classified_interest_immutable_fields'
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=""%'
  ),
  'classified interest guard trigger pins an empty search_path'
);


select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'classified_messages'
      and policyname = 'classified_messages_update_read_receipt'
      and cmd = 'UPDATE'
      and roles @> array['authenticated']::name[]
  )
  and has_column_privilege('authenticated','public.classified_messages','read_at','UPDATE')
  and not has_column_privilege('authenticated','public.classified_messages','sender_profile_id','UPDATE')
  and not has_column_privilege('authenticated','public.classified_messages','body','UPDATE'),
  'participants can update read receipts but cannot rewrite message body or sender identity'
);


select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'condominium_classifieds'
      and t.tgname = 'classified_listing_identity_guard'
      and not t.tgisinternal
  ),
  'classified listing tenant and seller identity fields are immutable'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'classifieds_storage_update_owner'
  ),
  'classified storage objects cannot be moved by UPDATE between tenant folders'
);

select * from finish();
rollback;
