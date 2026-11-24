begin;

select plan(1);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'resident_photos_update'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'resident_photos_delete'
      and qual like '%owner_id%'
      and qual like '%has_condominium_role%'
  ),
  'residents cannot update or delete another apartment member photo; own-file deletion and same-condo admin deletion remain'
);

select * from finish();
rollback;
