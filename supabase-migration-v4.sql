-- ============================================================
-- Con-Raumplan v4 — Phase 1: Slots als DB-Entität + Raum-Eigenschaften
-- als kontrollierte Chip-Liste statt Checkboxen.
-- NICHT destruktiv — additiv, sicher auf dem bestehenden, laufenden
-- Projekt auszuführen (SQL Editor → einfügen → Run). Idempotent: mehrfach
-- ausführen ist unproblematisch.
-- Baut auf supabase-schema.sql (v3) + supabase-migration-v3-roles.sql auf.
-- ============================================================

-- ---------- 1. Slot-Tagesabschnitts-Vorlagen (ersetzt den harten CUTOFF) ----------
create table if not exists slot_buckets (
  id uuid primary key default gen_random_uuid(),
  con_id uuid not null references cons(id) on delete cascade,
  label text not null,
  start_hour numeric(4,2) not null check (start_hour >= 0 and start_hour <= 24),
  end_hour   numeric(4,2) not null check (end_hour   >= 0 and end_hour   <= 24),
  sort int not null default 0,
  active boolean not null default true
);
alter table slot_buckets enable row level security;

-- ---------- 2. Konkrete Slots (pro Con, optional pro Tag) ----------
create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  con_id uuid not null references cons(id) on delete cascade,
  key text not null,      -- stabil, von assignments.slot_key referenziert
  label text not null,    -- frei von der Crew änderbar (Umbenennen)
  day date,               -- gesetzt bei Tag-gebundenen Slots, sonst NULL (manuelle Cons)
  bucket_id uuid references slot_buckets(id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table slots enable row level security;

-- ---------- 3. Backfill: bestehende Cons bekommen die bisherigen Vormittag/
-- Nachmittag-Buckets (Cutoff war bisher immer 14 Uhr), aber nur wenn eine
-- Con noch gar keine Buckets hat (idempotent, kein Duplizieren bei Re-Run).
insert into slot_buckets (con_id, label, start_hour, end_hour, sort)
select c.id, x.label, x.start_hour, x.end_hour, x.sort
from cons c
cross join (values
  ('Vormittag', 0::numeric, 14::numeric, 0),
  ('Nachmittag', 14::numeric, 24::numeric, 1)
) as x(label, start_hour, end_hour, sort)
where not exists (select 1 from slot_buckets b where b.con_id = c.id);

-- ---------- 4. Backfill: aus bereits vorhandenen assignments.slot_key-Werten
-- (Format bisher immer "YYYY-MM-DD|Teil") echte slots-Zeilen anlegen, BEVOR
-- die Fremdschlüsselbindung darauf gesetzt wird (sonst würde die Constraint
-- an bestehenden Daten scheitern).
insert into slots (con_id, key, label, day, sort)
select distinct a.con_id, a.slot_key,
  case when a.slot_key like '%|%'
    then to_char(split_part(a.slot_key, '|', 1)::date, 'DD.MM.') || ' ' || split_part(a.slot_key, '|', 2)
    else a.slot_key end,
  case when a.slot_key like '%|%' then split_part(a.slot_key, '|', 1)::date else null end,
  case when split_part(a.slot_key, '|', 2) = 'Nachmittag' then 1 else 0 end
from assignments a
where not exists (select 1 from slots s where s.con_id = a.con_id and s.key = a.slot_key);

alter table slots drop constraint if exists slots_con_id_key_key;
alter table slots add constraint slots_con_id_key_key unique (con_id, key);
create index if not exists slots_con_sort_idx on slots (con_id, sort);
create index if not exists slot_buckets_con_idx on slot_buckets (con_id, sort);

-- ---------- 5. Fremdschlüsselbindung: ein belegter Slot kann nicht mehr
-- versehentlich verschwinden (restrict statt cascade/set null — bewusst
-- strenger als bei table_id, weil "welcher Slot" wichtiger ist als "welcher
-- Tisch"). Jetzt sicher, da Schritt 4 jeden bestehenden slot_key abgedeckt hat.
alter table assignments drop constraint if exists assignments_slot_same_con_fkey;
alter table assignments add constraint assignments_slot_same_con_fkey
  foreign key (con_id, slot_key) references slots (con_id, key) on delete restrict;

-- ---------- 6. RLS-Policies: öffentlich lesen, Crew schreibt (etabliertes Muster) ----------
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

grant select on slot_buckets, slots to anon, authenticated;
grant insert, update, delete on slot_buckets, slots to authenticated;

-- ---------- 7. Slots für gegebene Tage materialisieren (Crew-only, siehe
-- supabase-schema.sql für die Trade-off-Begründung).
-- Schlüssel-Format bewusst "Tag|Bucket-Label" (nicht Bucket-ID), damit neu
-- materialisierte Slots für unveränderte Standard-Buckets exakt denselben
-- Schlüssel treffen wie die historischen, aus alten assignments gewonnenen
-- Slots (Schritt 4) — sonst gäbe es für denselben Tag doppelte Slot-Zeilen.
-- Rand-Fall: benennt die Crew zwei Buckets einer Con gleich, kollidiert der
-- zweite Slot-Key für neue Tage (on conflict do nothing) — akzeptiert, da
-- Bucket-Namen innerhalb einer Con eindeutig sein sollten.
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

-- ============================================================
-- Raum-Eigenschaften: kontrollierte Chip-Liste statt Checkboxen
-- ============================================================

-- ---------- 8. Globale, kontrollierte Vokabelliste ----------
-- Bewusst KEINE Insert/Update/Delete-Policy — wie superadmins nur per
-- SQL-Konsole erweiterbar, damit nicht jede Con die gemeinsame Liste
-- zumüllen kann. Öffentlich lesbar (reine Anzeige-Vokabel, kein Geheimnis).
create table if not exists feature_tags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort int not null default 0
);
alter table feature_tags enable row level security;
drop policy if exists "public read feature_tags" on feature_tags;
create policy "public read feature_tags" on feature_tags for select using (true);
grant select on feature_tags to anon, authenticated;

insert into feature_tags (key, label, sort) values
  ('barrierefrei', '♿ barrierefrei', 0),
  ('ruhig', '🤫 ruhig', 1),
  ('laut_ok', '🔊 laut ok', 2),
  ('bewegung', '🕺 Bewegung ok', 3),
  ('tageslicht', '☀️ Tageslicht', 4),
  ('kuehl', '❄️ eher kühl', 5),
  ('akustisch_gut', '👂 akustisch gut', 6)
on conflict (key) do nothing;

-- ---------- 9. Zuordnungstabelle pro Raum (Crew togglet Chips an/aus) ----------
create table if not exists room_feature_tags (
  con_id uuid not null,
  room_id uuid not null,
  feature_tag_id uuid not null references feature_tags(id) on delete cascade,
  primary key (con_id, room_id, feature_tag_id)
);
alter table room_feature_tags drop constraint if exists room_feature_tags_room_same_con_fkey;
alter table room_feature_tags add constraint room_feature_tags_room_same_con_fkey
  foreign key (con_id, room_id) references rooms (con_id, id) on delete cascade;
alter table room_feature_tags enable row level security;
drop policy if exists "public read room_feature_tags" on room_feature_tags;
create policy "public read room_feature_tags" on room_feature_tags for select using (true);
drop policy if exists "members write room_feature_tags" on room_feature_tags;
create policy "members write room_feature_tags" on room_feature_tags for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));
grant select on room_feature_tags to anon, authenticated;
grant insert, delete on room_feature_tags to authenticated;

-- ---------- 10. Backfill aus dem bisherigen rooms.features jsonb ----------
-- features-Spalte bleibt bestehen (kein Spaltendrop in derselben Phase, in
-- der sie zuletzt gelesen wird) — wird ab Phase 2 vom Code nicht mehr benutzt.
insert into room_feature_tags (con_id, room_id, feature_tag_id)
select r.con_id, r.id, ft.id
from rooms r
cross join lateral jsonb_each(r.features) as f(key, value)
join feature_tags ft on ft.key = f.key
where (f.value)::boolean = true
on conflict do nothing;
