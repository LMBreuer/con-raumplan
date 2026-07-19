-- Con-Raumplan: Datenbank-Schema für Supabase
-- Einspielen: Supabase-Dashboard → SQL Editor → einfügen → Run.
-- Kann gefahrlos erneut ausgeführt werden (idempotent).

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
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  seats int not null default 6,
  notes text,
  sort int not null default 0
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null,
  session_key text not null,
  table_id uuid references tables(id) on delete set null,
  manual_game jsonb,
  note text,
  updated_at timestamptz not null default now(),
  unique (slot_key, session_key)
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

alter table rooms enable row level security;
alter table tables enable row level security;
alter table assignments enable row level security;
alter table requests enable row level security;

-- Öffentlich lesbar: der Plan selbst
drop policy if exists "public read rooms" on rooms;
create policy "public read rooms" on rooms for select using (true);
drop policy if exists "public read tables" on tables;
create policy "public read tables" on tables for select using (true);
drop policy if exists "public read assignments" on assignments;
create policy "public read assignments" on assignments for select using (true);

-- Änderungswünsche: jede*r darf einreichen (nur mit Status 'offen' und ohne
-- Orga-Notiz), lesen/ändern darf sie nur die eingeloggte Orga.
drop policy if exists "anon insert requests" on requests;
create policy "anon insert requests" on requests for insert
  with check (status = 'offen' and orga_notiz is null and char_length(message) between 10 and 2000);
drop policy if exists "orga read requests" on requests;
create policy "orga read requests" on requests for select to authenticated using (true);
drop policy if exists "orga update requests" on requests;
create policy "orga update requests" on requests for update to authenticated using (true) with check (true);
drop policy if exists "orga delete requests" on requests;
create policy "orga delete requests" on requests for delete to authenticated using (true);

-- Schreiben am Plan: nur eingeloggte Orga
drop policy if exists "orga write rooms" on rooms;
create policy "orga write rooms" on rooms for all to authenticated using (true) with check (true);
drop policy if exists "orga write tables" on tables;
create policy "orga write tables" on tables for all to authenticated using (true) with check (true);
drop policy if exists "orga write assignments" on assignments;
create policy "orga write assignments" on assignments for all to authenticated using (true) with check (true);
