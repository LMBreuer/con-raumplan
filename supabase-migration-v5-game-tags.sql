-- ============================================================
-- Con-Raumplan v4 — Phase 6c: Spiel-Anforderungen ↔ Raum-Eigenschaften
-- Matching. NICHT destruktiv — additiv, sicher auf dem bestehenden,
-- laufenden Projekt auszuführen (SQL Editor → einfügen → Run). Idempotent:
-- mehrfach ausführen ist unproblematisch.
-- Baut auf supabase-schema.sql + supabase-migration-v4.sql auf.
-- ============================================================

-- ---------- Spiel-Anforderungen: dieselbe Vokabelliste (feature_tags) wie
-- Raum-Eigenschaften, nur an games statt rooms gehängt. ----------
create table if not exists game_required_tags (
  con_id uuid not null,
  game_id uuid not null,
  feature_tag_id uuid not null references feature_tags(id) on delete cascade,
  primary key (con_id, game_id, feature_tag_id)
);

-- Cross-Tenant-Härtung: analog zu room_feature_tags_room_same_con_fkey.
alter table game_required_tags drop constraint if exists game_required_tags_game_same_con_fkey;
alter table game_required_tags add constraint game_required_tags_game_same_con_fkey
  foreign key (con_id, game_id) references games (con_id, id) on delete cascade;

alter table game_required_tags enable row level security;

grant select on game_required_tags to anon, authenticated;
grant insert, delete on game_required_tags to authenticated;

-- ---------- Policies: game_required_tags (öffentlich lesen, Crew togglet) ----------
drop policy if exists "public read game_required_tags" on game_required_tags;
create policy "public read game_required_tags" on game_required_tags for select using (true);
drop policy if exists "members write game_required_tags" on game_required_tags;
create policy "members write game_required_tags" on game_required_tags for all to authenticated
  using (is_con_member(con_id)) with check (is_con_member(con_id));
