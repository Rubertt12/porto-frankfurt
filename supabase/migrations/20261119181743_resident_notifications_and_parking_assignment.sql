alter table public.parking_spaces
  add column if not exists status text not null default 'available'
  check (status in ('available','occupied','reserved','blocked'));

alter table public.parking_spaces
  add column if not exists vehicle_id uuid
  references public.vehicles(id) on delete set null;

create unique index if not exists parking_spaces_vehicle_id_unique
  on public.parking_spaces(vehicle_id) where vehicle_id is not null;

create or replace function public.validate_parking_space_vehicle_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vehicle_id is not null then
    if not exists (
      select 1 from public.vehicles v
      where v.id = new.vehicle_id
        and v.apartment_id = new.apartment_id
        and v.condominium_id = new.condominium_id
    ) then
      raise exception 'O veículo precisa pertencer à mesma unidade e ao mesmo condomínio da vaga.';
    end if;
    new.status := 'occupied';
  elsif tg_op = 'UPDATE' and old.vehicle_id is not null and new.status = 'occupied' then
    new.status := 'available';
  end if;
  return new;
end;
$$;

drop trigger if exists parking_space_vehicle_assignment_guard on public.parking_spaces;
create trigger parking_space_vehicle_assignment_guard
before insert or update of vehicle_id, apartment_id, condominium_id, status
on public.parking_spaces
for each row execute function public.validate_parking_space_vehicle_assignment();

create table if not exists public.resident_notifications (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in ('package','fine_warning','fine','general')),
  title text not null,
  body text not null,
  created_by uuid not null references public.profiles(id),
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint resident_notifications_read_at_check
    check ((is_read = false and read_at is null) or (is_read = true and read_at is not null))
);

create index if not exists resident_notifications_recipient_created_idx
  on public.resident_notifications(recipient_profile_id, created_at desc);
create index if not exists resident_notifications_condo_created_idx
  on public.resident_notifications(condominium_id, created_at desc);

alter table public.resident_notifications enable row level security;

drop policy if exists resident_notifications_read on public.resident_notifications;
create policy resident_notifications_read
on public.resident_notifications
for select to authenticated
using (
  public.can_access_condominium(condominium_id)
  and (
    recipient_profile_id = (select auth.uid())
    or public.has_condominium_role(
      condominium_id,
      array['super_admin','syndic','administrator']::public.condo_role[]
    )
  )
);

drop policy if exists resident_notifications_send on public.resident_notifications;
create policy resident_notifications_send
on public.resident_notifications
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.can_access_condominium(condominium_id)
  and public.has_condominium_role(
    condominium_id,
    array['super_admin','syndic','administrator']::public.condo_role[]
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

drop policy if exists resident_notifications_mark_read on public.resident_notifications;
create policy resident_notifications_mark_read
on public.resident_notifications
for update to authenticated
using (
  recipient_profile_id = (select auth.uid())
  and public.can_access_condominium(condominium_id)
)
with check (
  recipient_profile_id = (select auth.uid())
  and public.can_access_condominium(condominium_id)
);

grant select, insert on public.resident_notifications to authenticated;
grant update (is_read, read_at) on public.resident_notifications to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'resident_notifications'
  ) then
    alter publication supabase_realtime add table public.resident_notifications;
  end if;
end;
$$;
