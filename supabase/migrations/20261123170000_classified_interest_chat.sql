-- Classifieds: resident interest requests, private conversations and messages.
create table if not exists public.classified_interests (
 id uuid primary key default gen_random_uuid(),
 condominium_id uuid not null references public.condominiums(id) on delete cascade,
 classified_id uuid not null references public.condominium_classifieds(id) on delete cascade,
 buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
 seller_profile_id uuid not null references public.profiles(id) on delete cascade,
 buyer_apartment_id uuid not null references public.apartments(id) on delete cascade,
 seller_apartment_id uuid not null references public.apartments(id) on delete cascade,
 message text not null default '',
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint classified_interest_not_self check(buyer_profile_id<>seller_profile_id),
 constraint classified_interest_message_length check(char_length(message)<=1000),
 constraint classified_interest_once_per_buyer unique(classified_id,buyer_profile_id)
);
create index if not exists classified_interests_seller_idx on public.classified_interests(seller_profile_id,status,created_at desc);
create index if not exists classified_interests_buyer_idx on public.classified_interests(buyer_profile_id,created_at desc);
create table if not exists public.classified_conversations (
 id uuid primary key default gen_random_uuid(),
 condominium_id uuid not null references public.condominiums(id) on delete cascade,
 classified_id uuid not null references public.condominium_classifieds(id) on delete cascade,
 interest_id uuid not null unique references public.classified_interests(id) on delete cascade,
 buyer_profile_id uuid not null references public.profiles(id) on delete cascade,
 seller_profile_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint classified_conversation_not_self check(buyer_profile_id<>seller_profile_id)
);
create index if not exists classified_conversations_participants_idx on public.classified_conversations(condominium_id,buyer_profile_id,seller_profile_id);
create table if not exists public.classified_messages (
 id uuid primary key default gen_random_uuid(),
 condominium_id uuid not null references public.condominiums(id) on delete cascade,
 conversation_id uuid not null references public.classified_conversations(id) on delete cascade,
 sender_profile_id uuid not null references public.profiles(id) on delete cascade,
 body text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 constraint classified_message_body_length check(char_length(trim(body)) between 1 and 2000)
);
create index if not exists classified_messages_conversation_idx on public.classified_messages(conversation_id,created_at);
alter table public.classified_interests enable row level security;
alter table public.classified_conversations enable row level security;
alter table public.classified_messages enable row level security;
grant select,insert on public.classified_interests to authenticated;
grant update(status,updated_at) on public.classified_interests to authenticated;
grant select,insert on public.classified_conversations to authenticated;
grant select,insert on public.classified_messages to authenticated;
grant update(read_at) on public.classified_messages to authenticated;
drop policy if exists classified_interests_select_participants on public.classified_interests;
create policy classified_interests_select_participants on public.classified_interests for select to authenticated using (
 auth.uid() in (buyer_profile_id,seller_profile_id) and (can_access_condominium(condominium_id) or is_linked_to_condominium(condominium_id))
);
drop policy if exists classified_interests_insert_verified_resident on public.classified_interests;
create policy classified_interests_insert_verified_resident on public.classified_interests for insert to authenticated with check (
 buyer_profile_id=auth.uid() and status='pending'
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='resident' and p.is_active=true)
 and is_linked_to_apartment(buyer_apartment_id)
 and exists(select 1 from public.apartment_residents ar join public.resident_email_verifications v on v.profile_id=ar.profile_id and v.condominium_id=ar.condominium_id where ar.profile_id=auth.uid() and ar.apartment_id=buyer_apartment_id and ar.condominium_id=classified_interests.condominium_id and ar.move_out_date is null and v.verified_at is not null)
 and exists(select 1 from public.condominium_classifieds c join public.apartment_residents ar on ar.profile_id=c.seller_profile_id and ar.apartment_id=c.apartment_id and ar.condominium_id=c.condominium_id join public.profiles p on p.id=c.seller_profile_id and p.role='resident' and p.is_active=true join public.resident_email_verifications v on v.profile_id=c.seller_profile_id and v.condominium_id=c.condominium_id and v.verified_at is not null where c.id=classified_interests.classified_id and c.condominium_id=classified_interests.condominium_id and c.seller_profile_id=classified_interests.seller_profile_id and c.apartment_id=classified_interests.seller_apartment_id and c.status='available' and c.seller_profile_id<>auth.uid() and ar.move_out_date is null)
);
drop policy if exists classified_interests_update_participants on public.classified_interests;
create policy classified_interests_update_participants on public.classified_interests for update to authenticated using(seller_profile_id=auth.uid() or buyer_profile_id=auth.uid()) with check (
 (seller_profile_id=auth.uid() and buyer_profile_id<>auth.uid() and status in ('pending','accepted','declined','cancelled'))
 or (buyer_profile_id=auth.uid() and seller_profile_id<>auth.uid() and status in ('pending','cancelled'))
);
drop policy if exists classified_conversations_select_participants on public.classified_conversations;
create policy classified_conversations_select_participants on public.classified_conversations for select to authenticated using (
 auth.uid() in (buyer_profile_id,seller_profile_id) and (can_access_condominium(condominium_id) or is_linked_to_condominium(condominium_id))
);
drop policy if exists classified_conversations_insert_from_interest on public.classified_conversations;
create policy classified_conversations_insert_from_interest on public.classified_conversations for insert to authenticated with check (
 auth.uid() in (buyer_profile_id,seller_profile_id) and exists(select 1 from public.classified_interests i where i.id=interest_id and i.condominium_id=classified_conversations.condominium_id and i.classified_id=classified_conversations.classified_id and i.buyer_profile_id=classified_conversations.buyer_profile_id and i.seller_profile_id=classified_conversations.seller_profile_id)
);
drop policy if exists classified_messages_select_participants on public.classified_messages;
create policy classified_messages_select_participants on public.classified_messages for select to authenticated using (
 sender_profile_id=auth.uid() or exists(select 1 from public.classified_conversations c where c.id=conversation_id and auth.uid() in(c.buyer_profile_id,c.seller_profile_id) and c.condominium_id=classified_messages.condominium_id)
);
drop policy if exists classified_messages_insert_participants on public.classified_messages;
create policy classified_messages_insert_participants on public.classified_messages for insert to authenticated with check (
 sender_profile_id=auth.uid() and exists(select 1 from public.classified_conversations c where c.id=conversation_id and auth.uid() in(c.buyer_profile_id,c.seller_profile_id) and c.condominium_id=classified_messages.condominium_id)
);
drop policy if exists classified_messages_update_participants on public.classified_messages;
create policy classified_messages_update_participants on public.classified_messages for update to authenticated using (
 exists(select 1 from public.classified_conversations c where c.id=conversation_id and auth.uid() in(c.buyer_profile_id,c.seller_profile_id))
) with check (
 exists(select 1 from public.classified_conversations c where c.id=conversation_id and auth.uid() in(c.buyer_profile_id,c.seller_profile_id))
);
alter table public.resident_notifications drop constraint if exists resident_notifications_notification_type_check;
alter table public.resident_notifications add constraint resident_notifications_notification_type_check check(notification_type=any(array['package','fine_warning','fine','general','classified_interest']));
drop policy if exists resident_notifications_send on public.resident_notifications;
drop policy if exists resident_notifications_send on public.resident_notifications;
create policy resident_notifications_send on public.resident_notifications for insert to authenticated with check (
 created_by=auth.uid() and (can_access_condominium(condominium_id) or is_linked_to_condominium(condominium_id))
 and (has_condominium_role(condominium_id,array['super_admin'::condo_role,'syndic'::condo_role,'administrator'::condo_role])
 or (notification_type='classified_interest' and exists(select 1 from public.classified_interests i where i.buyer_profile_id=auth.uid() and i.seller_profile_id=resident_notifications.recipient_profile_id and i.condominium_id=resident_notifications.condominium_id and i.seller_apartment_id=resident_notifications.apartment_id))
 or (notification_type=any(array['package','general']) and has_condominium_role(condominium_id,array['concierge'::condo_role,'security'::condo_role])))
 and exists(select 1 from public.apartment_residents ar where ar.profile_id=recipient_profile_id and ar.apartment_id=resident_notifications.apartment_id and ar.condominium_id=resident_notifications.condominium_id and ar.move_out_date is null)
 and exists(select 1 from public.apartments a where a.id=apartment_id and a.condominium_id=resident_notifications.condominium_id)
);
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='classified_messages') then
  alter publication supabase_realtime add table public.classified_messages;
 end if;
end $$;
