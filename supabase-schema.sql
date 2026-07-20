-- ============================================================
-- Con-Raumplan v2: Mandantenfähiges Schema (mehrere Cons)
-- Einspielen: Supabase-Dashboard → SQL Editor → einfügen → Run.
-- Safe erneut auszuführen (idempotent).
--
-- ACHTUNG: Der TRUNCATE-Block unten leert rooms/tables/assignments/
-- requests komplett (bestehende Testdaten werden bewusst verworfen,
-- siehe Projekt-Entscheidung). Wenn du eigene echte Daten behalten
-- willst, diesen Block NICHT ausführen und stattdessen manuell
-- migrieren.
-- ============================================================

-- ---------- Bestehende Tabellen (falls schon vorhanden) ----------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  floor text,
  features jsonb not null default '{}',
  notes text,
  sort int not null default 0
);

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  name text not null,
  seats int not null default 6,
  notes text,
  sort int not null default 0
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null,
  session_key text not null,
  table_id uuid,
  manual_game jsonb,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_ref text,
  message text not null,
  contact text,
  status text not null default 'offen',
  orga_notiz text
);

-- ---------- Neu: Cons + Crew-Mitgliedschaft ----------
create table if not exists cons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  playabl_event_id text,
  playabl_community_id text,
  slug text unique,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists con_members (
  con_id uuid not null references cons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (con_id, user_id)
);

-- ============================================================
-- TESTDATEN VERWERFEN — bewusste Entscheidung, siehe Kommentar oben.
-- ============================================================
truncate table assignments, tables, rooms, requests;

-- ---------- con_id-Spalten hinzufügen ----------
alter table rooms       add column if not exists con_id uuid references cons(id) on delete cascade;
alter table tables      add column if not exists con_id uuid references cons(id) on delete cascade;
alter table assignments add column if not exists con_id uuid references cons(id) on delete cascade;
alter table requests    add column if not exists con_id uuid references cons(id) on delete cascade;

alter table rooms       alter column con_id set not null;
alter table tables      alter column con_id set not null;
alter table assignments alter column con_id set not null;
alter table requests    alter column con_id set not null;

-- ---------- Cross-Tenant-Härtung: Tisch/Zuordnung muss zur selben Con gehören ----------
alter table rooms  drop constraint if exists rooms_con_id_id_key;
alter table rooms  add constraint rooms_con_id_id_key unique (con_id, id);
alter table tables drop constraint if exists tables_con_id_id_key;
alter table tables add constraint tables_con_id_id_key unique (con_id, id);

alter table tables drop constraint if exists tables_room_id_fkey;
alter table tables drop constraint if exists tables_room_same_con_fkey;
alter table tables add constraint tables_room_same_con_fkey
  foreign key (con_id, room_id) references rooms (con_id, id) on delete cascade;

alter table assignments drop constraint if exists assignments_table_id_fkey;
alter table assignments drop constraint if exists assignments_table_same_con_fkey;
alter table assignments add constraint assignments_table_same_con_fkey
  foreign key (con_id, table_id) references tables (con_id, id) on delete set null;

alter table assignments drop constraint if exists assignments_slot_key_session_key_key;
alter table assignments drop constraint if exists assignments_con_slot_session_key;
alter table assignments add constraint assignments_con_slot_session_key
  unique (con_id, slot_key, session_key);

-- ---------- RLS aktivieren ----------
alter table rooms       enable row level security;
alter table tables      enable row level security;
alter table assignments enable row level security;
alter table requests    enable row level security;
alter table cons        enable row level security;
alter table con_members enable row level security;
-- Bewusst KEIN "force row level security" auf con_members/cons — würde den
-- security-definer-Bypass in is_con_member() unterlaufen (siehe unten).

-- ---------- Helper-Funktionen (alle security definer, search_path gepinnt) ----------
create or replace function public.is_con_member(target_con uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.con_members
    where con_id = target_con and user_id = auth.uid()
  );
$$;
revoke all on function public.is_con_member(uuid) from public;
grant execute on function public.is_con_member(uuid) to authenticated;

create or replace function public.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.con_members (con_id, user_id)
  values (new.id, new.created_by)
  on conflict (con_id, user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists cons_after_insert on cons;
create trigger cons_after_insert
  after insert on cons
  for each row execute function public.add_creator_as_member();

-- Einladen per E-Mail: eine kombinierte Funktion (kein freistehendes
-- E-Mail-Lookup-Orakel), prüft intern Mitgliedschaft, löst E-Mail auf, fügt ein.
create or replace function public.invite_member_to_con(target_con uuid, invite_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_uid uuid;
begin
  if not public.is_con_member(target_con) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id into found_uid from auth.users where email = invite_email limit 1;
  if found_uid is null then
    raise exception 'no account found for that email' using errcode = 'P0002';
  end if;
  insert into public.con_members (con_id, user_id)
  values (target_con, found_uid)
  on conflict (con_id, user_id) do nothing;
end;
$$;
revoke all on function public.invite_member_to_con(uuid, text) from public;
grant execute on function public.invite_member_to_con(uuid, text) to authenticated;

-- Crew-Liste (+ E-Mail) für die Team-Verwaltung
create or replace function public.list_con_members(target_con uuid)
returns table(user_id uuid, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_con_member(target_con) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select cm.user_id, u.email::text
    from public.con_members cm
    join auth.users u on u.id = cm.user_id
    where cm.con_id = target_con;
end;
$$;
revoke all on function public.list_con_members(uuid) from public;
grant execute on function public.list_con_members(uuid) to authenticated;

-- Verhindert, dass das letzte Crew-Mitglied einer Con entfernt wird (Con würde verwaisen)
create or replace function public.prevent_removing_last_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.con_members where con_id = old.con_id) <= 1 then
    raise exception 'cannot remove the last member of a Con';
  end if;
  return old;
end;
$$;
drop trigger if exists con_members_before_delete on con_members;
create trigger con_members_before_delete
  before delete on con_members
  for each row execute function public.prevent_removing_last_member();

-- ---------- Grants (explizit, unabhängig von Projekt-Defaults) ----------
grant select on cons to anon, authenticated;
grant insert, update on cons to authenticated;
grant select, insert, delete on con_members to authenticated;

-- ---------- Policies: cons ----------
drop policy if exists "public read cons" on cons;
create policy "public read cons" on cons for select using (true);
drop policy if exists "authed create cons" on cons;
create policy "authed create cons" on cons for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists "members update own con" on cons;
create policy "members update own con" on cons for update to authenticated
  using (is_con_member(id)) with check (is_con_member(id));
-- Bewusst keine DELETE-Policy auf cons — zu destruktiv für v1.

-- ---------- Policies: con_members ----------
drop policy if exists "members read own con roster" on con_members;
create policy "members read own con roster" on con_members for select to authenticated
  using (is_con_member(con_id));
drop policy if exists "members add teammates" on con_members;
create policy "members add teammates" on con_members for insert to authenticated
  with check (is_con_member(con_id));
drop policy if exists "members remove teammates" on con_members;
create policy "members remove teammates" on con_members for delete to authenticated
  using (is_con_member(con_id));

-- ---------- Policies: rooms / tables / assignments ----------
drop policy if exists "public read rooms" on rooms;
create policy "public read rooms" on rooms for select using (true);
drop policy if exists "orga write rooms" on rooms;
drop policy if exists "members write rooms" on rooms;
create policy "members write rooms" on rooms for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

drop policy if exists "public read tables" on tables;
create policy "public read tables" on tables for select using (true);
drop policy if exists "orga write tables" on tables;
drop policy if exists "members write tables" on tables;
create policy "members write tables" on tables for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

drop policy if exists "public read assignments" on assignments;
create policy "public read assignments" on assignments for select using (true);
drop policy if exists "orga write assignments" on assignments;
drop policy if exists "members write assignments" on assignments;
create policy "members write assignments" on assignments for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

-- ---------- Policies: requests (kein anonymes Lesen — nur einreichen) ----------
drop policy if exists "anon insert requests" on requests;
create policy "anon insert requests" on requests for insert
  with check (status = 'offen' and orga_notiz is null and char_length(message) between 10 and 2000);
drop policy if exists "orga read requests" on requests;
drop policy if exists "public read requests" on requests;
drop policy if exists "members read requests" on requests;
create policy "members read requests" on requests for select to authenticated
  using (is_con_member(con_id));
drop policy if exists "orga update requests" on requests;
drop policy if exists "members update requests" on requests;
create policy "members update requests" on requests for update to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));
drop policy if exists "orga delete requests" on requests;
drop policy if exists "members delete requests" on requests;
create policy "members delete requests" on requests for delete to authenticated
  using (is_con_member(con_id));
