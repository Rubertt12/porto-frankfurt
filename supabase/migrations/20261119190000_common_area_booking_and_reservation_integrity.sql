-- Common area booking metadata and reservation integrity.
create extension if not exists btree_gist with schema extensions;

alter table public.common_areas
  add column if not exists area_type text not null default 'other',
  add column if not exists capacity integer;

update public.common_areas
set area_type = case
  when lower(name) like '%quiosque%' then 'kiosk'
  when lower(name) like '%salão%' or lower(name) like '%salao%' then 'party_room'
  when lower(name) like '%futebol%' then 'football_court'
  when lower(name) like '%quadra%' then 'sports_court'
  when lower(name) like '%piscina%' then 'pool'
  when lower(name) like '%playground%' then 'playground'
  else coalesce(area_type, 'other')
end;

alter table public.common_areas
  add constraint common_areas_capacity_positive
  check (capacity is null or capacity > 0);

alter table public.reservations
  add constraint reservations_valid_period
  check (ends_at > starts_at);

alter table public.common_areas
  add constraint common_areas_id_condominium_unique unique (id, condominium_id);

alter table public.apartments
  add constraint apartments_id_condominium_unique unique (id, condominium_id);

alter table public.reservations
  add constraint reservations_area_same_condominium
  foreign key (area_id, condominium_id)
  references public.common_areas (id, condominium_id);

alter table public.reservations
  add constraint reservations_apartment_same_condominium
  foreign key (apartment_id, condominium_id)
  references public.apartments (id, condominium_id);

alter table public.reservations
  add constraint reservations_no_overlapping_area_times
  exclude using gist (
    area_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'approved'));
