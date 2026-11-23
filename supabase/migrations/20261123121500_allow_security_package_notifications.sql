-- Keep both operational portaria roles able to notify residents about received packages.
drop policy if exists resident_notifications_send on public.resident_notifications;
create policy resident_notifications_send
on public.resident_notifications
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.can_access_condominium(condominium_id)
  and (
    public.has_condominium_role(
      condominium_id,
      array['super_admin','syndic','administrator']::public.condo_role[]
    )
    or (
      notification_type in ('package','general')
      and public.has_condominium_role(
        condominium_id,
        array['concierge','security']::public.condo_role[]
      )
    )
  )
  and exists (
    select 1
    from public.apartment_residents ar
    where ar.profile_id = recipient_profile_id
      and ar.apartment_id = resident_notifications.apartment_id
      and ar.condominium_id = resident_notifications.condominium_id
  )
  and exists (
    select 1
    from public.apartments a
    where a.id = resident_notifications.apartment_id
      and a.condominium_id = resident_notifications.condominium_id
  )
);
