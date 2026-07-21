-- ============================================================
-- Con-Raumplan v3: Mandantenfähiges Schema mit Rollen
-- Einspielen (NEUES Projekt): Supabase-Dashboard → SQL Editor → einfügen → Run.
-- Safe erneut auszuführen (idempotent).
--
-- Für ein BESTEHENDES Projekt, auf dem schon die v2-Version läuft:
-- NICHT diese Datei erneut ausführen (der TRUNCATE-Block würde eure
-- echten Daten löschen) — stattdessen nur supabase-migration-v3-roles.sql
-- einspielen, die ist additiv und nicht destruktiv.
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

-- ---------- Cons + Crew-Mitgliedschaft (mit Rollen) ----------
create table if not exists cons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  playabl_event_id text,
  playabl_community_id text,
  slug text unique,
  listed boolean not null default true,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists con_members (
  con_id uuid not null references cons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin','editor')),
  status text not null default 'pending' check (status in ('pending','accepted')),
  added_at timestamptz not null default now(),
  primary key (con_id, user_id)
);

-- ---------- Slots (Tagesabschnitts-Vorlagen + konkrete, pro-Con-Slots) ----------
create table if not exists slot_buckets (
  id uuid primary key default gen_random_uuid(),
  con_id uuid not null references cons(id) on delete cascade,
  label text not null,
  start_hour numeric(4,2) not null check (start_hour >= 0 and start_hour <= 24),
  end_hour   numeric(4,2) not null check (end_hour   >= 0 and end_hour   <= 24),
  sort int not null default 0,
  active boolean not null default true
);

create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  con_id uuid not null references cons(id) on delete cascade,
  key text not null,
  label text not null,
  day date,
  bucket_id uuid references slot_buckets(id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Raum-Eigenschaften: kontrollierte, globale Chip-Vokabelliste ----------
create table if not exists feature_tags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort int not null default 0
);

create table if not exists room_feature_tags (
  con_id uuid not null,
  room_id uuid not null,
  feature_tag_id uuid not null references feature_tags(id) on delete cascade,
  primary key (con_id, room_id, feature_tag_id)
);

-- ---------- Spiel-Anforderungen: dieselbe Vokabelliste (feature_tags) wie
-- Raum-Eigenschaften, nur an games statt rooms gehängt — fürs Matching. ----------
create table if not exists game_required_tags (
  con_id uuid not null,
  game_id uuid not null,
  feature_tag_id uuid not null references feature_tags(id) on delete cascade,
  primary key (con_id, game_id, feature_tag_id)
);

-- ---------- Spiele (ersetzt den manual_game-jsonb-Blob in assignments) ----------
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  con_id uuid not null references cons(id) on delete cascade,
  title text not null,
  provider text,
  seats int not null default 4,
  workshop boolean not null default false,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TESTDATEN VERWERFEN — nur bei einer frischen/absichtlich zurückgesetzten
-- Datenbank ausführen. Auf einem bestehenden v2-Projekt NICHT ausführen!
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

alter table slots drop constraint if exists slots_con_id_key_key;
alter table slots add constraint slots_con_id_key_key unique (con_id, key);
create index if not exists slots_con_sort_idx on slots (con_id, sort);
create index if not exists slot_buckets_con_idx on slot_buckets (con_id, sort);

-- Ein belegter Slot kann nicht mehr versehentlich verschwinden (restrict statt
-- cascade/set null — strenger als bei table_id, da "welcher Slot" wichtiger
-- ist als "welcher Tisch").
alter table assignments drop constraint if exists assignments_slot_same_con_fkey;
alter table assignments add constraint assignments_slot_same_con_fkey
  foreign key (con_id, slot_key) references slots (con_id, key) on delete restrict;

alter table room_feature_tags drop constraint if exists room_feature_tags_room_same_con_fkey;
alter table room_feature_tags add constraint room_feature_tags_room_same_con_fkey
  foreign key (con_id, room_id) references rooms (con_id, id) on delete cascade;

alter table games drop constraint if exists games_con_id_id_key;
alter table games add constraint games_con_id_id_key unique (con_id, id);

alter table game_required_tags drop constraint if exists game_required_tags_game_same_con_fkey;
alter table game_required_tags add constraint game_required_tags_game_same_con_fkey
  foreign key (con_id, game_id) references games (con_id, id) on delete cascade;

-- Ein Spiel hat höchstens eine Platzierungszeile (partieller Unique-Index) —
-- "verschieben" ist ein UPDATE dieser einen Zeile, nie ein zweiter Insert.
alter table assignments add column if not exists game_id uuid;
alter table assignments drop constraint if exists assignments_game_same_con_fkey;
alter table assignments add constraint assignments_game_same_con_fkey
  foreign key (con_id, game_id) references games (con_id, id) on delete cascade;
create unique index if not exists assignments_one_row_per_game_idx
  on assignments (con_id, game_id) where game_id is not null;

-- ---------- RLS aktivieren ----------
alter table rooms       enable row level security;
alter table tables      enable row level security;
alter table assignments enable row level security;
alter table requests    enable row level security;
alter table cons        enable row level security;
alter table con_members enable row level security;
alter table slot_buckets enable row level security;
alter table slots        enable row level security;
alter table feature_tags enable row level security;
alter table room_feature_tags enable row level security;
alter table games enable row level security;
alter table game_required_tags enable row level security;
-- Bewusst KEIN "force row level security" auf con_members/cons — würde den
-- security-definer-Bypass in is_con_member()/is_con_admin() unterlaufen.

-- ---------- Super-Admin (site-weit, nicht pro Con) ----------
-- Bewusst KEINE Policies auf dieser Tabelle — nur über die SQL-Konsole
-- direkt befüllbar (Postgres-Owner-Rolle umgeht RLS), nie über den Client.
create table if not exists superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table superadmins enable row level security;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.superadmins where user_id = auth.uid()); $$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

-- ---------- Helper-Funktionen (alle security definer, search_path gepinnt) ----------
-- Super-Admin besteht is_con_member/is_con_admin für JEDE Con automatisch mit
-- ("Durchgriffsrecht auf alles"), ohne eigene con_members-Zeile.
create or replace function public.is_con_member(target_con uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1 from public.con_members
    where con_id = target_con and user_id = auth.uid() and status = 'accepted'
  );
$$;
revoke all on function public.is_con_member(uuid) from public;
grant execute on function public.is_con_member(uuid) to authenticated;

create or replace function public.is_con_admin(target_con uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1 from public.con_members
    where con_id = target_con and user_id = auth.uid() and status = 'accepted' and role = 'admin'
  );
$$;
revoke all on function public.is_con_admin(uuid) from public;
grant execute on function public.is_con_admin(uuid) to authenticated;

-- Con-Ersteller wird sofort akzeptierter Admin (kein Henne-Ei-Problem)
create or replace function public.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.con_members (con_id, user_id, role, status)
  values (new.id, new.created_by, 'admin', 'accepted')
  on conflict (con_id, user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists cons_after_insert on cons;
create trigger cons_after_insert
  after insert on cons
  for each row execute function public.add_creator_as_member();

-- Einladen per E-Mail (nur Admins), mit Rollenwahl, legt PENDING an — die
-- eingeladene Person muss selbst bestätigen (siehe accept_invite unten).
-- Alte 2-Parameter-Version vorsorglich droppen (siehe Migration v3 für den
-- Grund: sonst entsteht eine parallele, veraltete Überladung).
drop function if exists public.invite_member_to_con(uuid, text);
create or replace function public.invite_member_to_con(target_con uuid, invite_email text, invite_role text default 'editor')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_uid uuid;
begin
  if invite_role not in ('admin','editor') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if not public.is_con_admin(target_con) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id into found_uid from auth.users where email = invite_email limit 1;
  if found_uid is null then
    raise exception 'no account found for that email' using errcode = 'P0002';
  end if;
  insert into public.con_members (con_id, user_id, role, status)
  values (target_con, found_uid, invite_role, 'pending')
  on conflict (con_id, user_id) do nothing;
end;
$$;
revoke all on function public.invite_member_to_con(uuid, text, text) from public;
grant execute on function public.invite_member_to_con(uuid, text, text) to authenticated;

create or replace function public.accept_invite(target_con uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.con_members set status = 'accepted'
  where con_id = target_con and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'keine offene Einladung gefunden' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

create or replace function public.decline_invite(target_con uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.con_members
  where con_id = target_con and user_id = auth.uid() and status = 'pending';
end;
$$;
revoke all on function public.decline_invite(uuid) from public;
grant execute on function public.decline_invite(uuid) to authenticated;

create or replace function public.list_my_invites()
returns table(con_id uuid, con_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.con_id, c.name, cm.role
  from public.con_members cm
  join public.cons c on c.id = cm.con_id
  where cm.user_id = auth.uid() and cm.status = 'pending';
$$;
revoke all on function public.list_my_invites() from public;
grant execute on function public.list_my_invites() to authenticated;

-- Crew-Liste (+ E-Mail, Rolle, Status) für die Team-Verwaltung
drop function if exists public.list_con_members(uuid);
create or replace function public.list_con_members(target_con uuid)
returns table(user_id uuid, email text, role text, status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_con_member(target_con) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select cm.user_id, u.email::text, cm.role, cm.status
    from public.con_members cm
    join auth.users u on u.id = cm.user_id
    where cm.con_id = target_con;
end;
$$;
revoke all on function public.list_con_members(uuid) from public;
grant execute on function public.list_con_members(uuid) to authenticated;

-- Verhindert, dass der letzte Admin einer Con entfernt/herabgestuft wird
create or replace function public.prevent_removing_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Wird durch die "on delete cascade"-Kette beim Löschen der ganzen Con
  -- ausgelöst (con_members hängt an cons), nicht nur durch gezieltes
  -- Entfernen/Herabstufen eines Mitglieds. In dem Fall existiert die Con zu
  -- diesem Zeitpunkt bereits nicht mehr (Elternzeile ist im selben Statement
  -- vorher gelöscht worden) — dann greift der Schutz nicht, sonst könnte eine
  -- Con mit nur einem Admin nie gelöscht werden (Super-Admin eingeschlossen).
  if TG_OP = 'DELETE' and not exists (select 1 from public.cons where id = old.con_id) then
    return old;
  end if;
  if (TG_OP = 'DELETE' and old.role = 'admin' and old.status = 'accepted')
     or (TG_OP = 'UPDATE' and old.role = 'admin' and old.status = 'accepted'
         and (new.role <> 'admin' or new.status <> 'accepted')) then
    if (select count(*) from public.con_members
        where con_id = old.con_id and role = 'admin' and status = 'accepted' and user_id <> old.user_id) = 0 then
      raise exception 'cannot remove or demote the last admin of a Con' using errcode = 'P0001';
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists con_members_before_delete on con_members;
drop trigger if exists con_members_before_delete_or_update on con_members;
create trigger con_members_before_delete_or_update
  before delete or update on con_members
  for each row execute function public.prevent_removing_last_admin();

-- Slots für gegebene Tage materialisieren (Crew-only). Schlüssel-Format
-- bewusst "Tag|Bucket-Label" (nicht Bucket-ID) — siehe
-- supabase-migration-v4.sql für die ausführliche Begründung.
create or replace function public.ensure_slots_for_days(target_con uuid, days date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date;
  b record;
begin
  if not public.is_con_member(target_con) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  foreach d in array days loop
    for b in select * from public.slot_buckets where con_id = target_con and active order by sort loop
      insert into public.slots (con_id, key, label, day, bucket_id, sort)
      values (target_con, d::text || '|' || b.label, to_char(d, 'DD.MM.') || ' ' || b.label, d, b.id, b.sort)
      on conflict (con_id, key) do nothing;
    end loop;
  end loop;
end;
$$;
revoke all on function public.ensure_slots_for_days(uuid, date[]) from public;
grant execute on function public.ensure_slots_for_days(uuid, date[]) to authenticated;

-- ---------- Grants (explizit, unabhängig von Projekt-Defaults) ----------
grant select on cons to anon, authenticated;
grant insert, update on cons to authenticated;
grant select, insert, update, delete on con_members to authenticated;
grant select on slot_buckets, slots to anon, authenticated;
grant insert, update, delete on slot_buckets, slots to authenticated;
grant select on feature_tags to anon, authenticated;
grant select on room_feature_tags to anon, authenticated;
grant insert, delete on room_feature_tags to authenticated;
grant select on games to anon, authenticated;
grant insert, update, delete on games to authenticated;
grant select on game_required_tags to anon, authenticated;
grant insert, delete on game_required_tags to authenticated;

-- ---------- Policies: cons ----------
drop policy if exists "public read cons" on cons;
create policy "public read cons" on cons for select using (true);
drop policy if exists "authed create cons" on cons;
create policy "authed create cons" on cons for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists "members update own con" on cons;
drop policy if exists "admins update own con" on cons;
create policy "admins update own con" on cons for update to authenticated
  using (is_con_admin(id)) with check (is_con_admin(id));
-- Löschen bleibt bewusst auf Super-Admin beschränkt (nicht mal Con-Admins
-- dürfen ihre eigene Con löschen) — zu destruktiv für normale Crew-Rechte.
drop policy if exists "superadmin delete cons" on cons;
create policy "superadmin delete cons" on cons for delete to authenticated
  using (is_superadmin());

-- ---------- Policies: con_members ----------
drop policy if exists "members read own con roster" on con_members;
create policy "members read own con roster" on con_members for select to authenticated
  using (is_con_member(con_id));
drop policy if exists "members add teammates" on con_members;
drop policy if exists "admins add teammates" on con_members;
create policy "admins add teammates" on con_members for insert to authenticated
  with check (is_con_admin(con_id));
drop policy if exists "members remove teammates" on con_members;
drop policy if exists "admins or self remove" on con_members;
create policy "admins or self remove" on con_members for delete to authenticated
  using (is_con_admin(con_id) or user_id = auth.uid());
drop policy if exists "admins update roles" on con_members;
create policy "admins update roles" on con_members for update to authenticated
  using (is_con_admin(con_id) or user_id = auth.uid())
  with check (is_con_admin(con_id) or user_id = auth.uid());

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

-- ---------- Policies: slot_buckets / slots (öffentlich lesen, Crew schreibt) ----------
drop policy if exists "public read slot_buckets" on slot_buckets;
create policy "public read slot_buckets" on slot_buckets for select using (true);
drop policy if exists "members write slot_buckets" on slot_buckets;
create policy "members write slot_buckets" on slot_buckets for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

drop policy if exists "public read slots" on slots;
create policy "public read slots" on slots for select using (true);
drop policy if exists "members write slots" on slots;
create policy "members write slots" on slots for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

-- ---------- Policies: feature_tags (global, nur per SQL-Konsole erweiterbar) ----------
drop policy if exists "public read feature_tags" on feature_tags;
create policy "public read feature_tags" on feature_tags for select using (true);
-- Bewusst KEINE Insert/Update/Delete-Policy — siehe Kommentar bei superadmins.

-- ---------- Policies: room_feature_tags (öffentlich lesen, Crew togglet) ----------
drop policy if exists "public read room_feature_tags" on room_feature_tags;
create policy "public read room_feature_tags" on room_feature_tags for select using (true);
drop policy if exists "members write room_feature_tags" on room_feature_tags;
create policy "members write room_feature_tags" on room_feature_tags for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

-- ---------- Policies: games (öffentlich lesen, Crew schreibt) ----------
drop policy if exists "public read games" on games;
create policy "public read games" on games for select using (true);
drop policy if exists "members write games" on games;
create policy "members write games" on games for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

-- ---------- Policies: game_required_tags (öffentlich lesen, Crew togglet) ----------
drop policy if exists "public read game_required_tags" on game_required_tags;
create policy "public read game_required_tags" on game_required_tags for select using (true);
drop policy if exists "members write game_required_tags" on game_required_tags;
create policy "members write game_required_tags" on game_required_tags for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));

-- ---------- Seed: kontrollierte Vokabelliste für Raum-Eigenschaften ----------
insert into feature_tags (key, label, sort) values
  ('barrierefrei', '♿ barrierefrei', 0),
  ('ruhig', '🤫 ruhig', 1),
  ('laut_ok', '🔊 laut ok', 2),
  ('bewegung', '🕺 Bewegung ok', 3),
  ('tageslicht', '☀️ Tageslicht', 4),
  ('kuehl', '❄️ eher kühl', 5),
  ('akustisch_gut', '👂 akustisch gut', 6)
on conflict (key) do nothing;
