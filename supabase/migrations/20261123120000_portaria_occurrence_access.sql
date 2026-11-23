-- Give concierge and security staff a scoped operational occurrence log.
-- They can create and read occurrences, but only management can resolve or delete them.
drop policy if exists occurrences_portaria_read on public.occurrences;
create policy occurrences_portaria_read
on public.occurrences
for select to authenticated
using (
  public.can_access_condominium(condominium_id)
  and public.has_condo_role(
    array['concierge'::public.condo_role,'security'::public.condo_role]
  )
);

drop policy if exists occurrences_portaria_insert on public.occurrences;
create policy occurrences_portaria_insert
on public.occurrences
for insert to authenticated
with check (
  public.can_access_condominium(condominium_id)
  and public.has_condo_role(
    array['concierge'::public.condo_role,'security'::public.condo_role]
  )
  and reported_by = (select auth.uid())
  and exists (
    select 1
    from public.apartments a
    where a.id = occurrences.apartment_id
      and a.condominium_id = occurrences.condominium_id
  )
);
