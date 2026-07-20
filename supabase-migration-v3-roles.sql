-- ============================================================
-- Con-Raumplan v3: Rollen (Admin/Bearbeiter) + Einladungsbestätigung
-- NICHT destruktiv — kein TRUNCATE, sicher auf dem bestehenden,
-- bereits laufenden Projekt auszuführen (SQL Editor → einfügen → Run).
-- Baut auf supabase-schema.sql (v2) auf.
-- ============================================================

-- ---------- 0. Sichtbarkeit in der öffentlichen Con-Liste ----------
-- Playabl-verknüpfte Cons sind automatisch gelistet (die Verknüpfung ist der
-- Echtheits-Nachweis); rein manuelle Cons sind per Default ungelistet, aber
-- über den direkten Link weiterhin voll erreichbar und von der Crew jederzeit
-- änderbar. Bestehende Zeilen bleiben gelistet (kein rückwirkendes Verstecken).
alter table cons add column if not exists listed boolean not null default true;

-- ---------- 0b. Super-Admin (site-weit, nicht pro Con) ----------
-- Bewusst KEINE Policies auf dieser Tabelle — niemand darf sie über den
-- Client (anon-Key) lesen oder schreiben, nur über die SQL-Konsole direkt
-- (die dortige Postgres-Rolle umgeht RLS). Wer hier eingetragen wird, siehst
-- du separat — nicht in diesem Skript, um keine echte E-Mail/UUID in ein
-- öffentliches Repo zu committen.
create table if not exists superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table superadmins enable row level security;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.superadmins where user_id = auth.uid()); $$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

drop policy if exists "superadmin delete cons" on cons;
create policy "superadmin delete cons" on cons for delete to authenticated
  using (is_superadmin());

-- ---------- 1. Neue Spalten auf con_members (bestehende Zeilen korrekt befüllen) ----------
alter table con_members add column if not exists role text;
alter table con_members add column if not exists status text;
update con_members set role = coalesce(role, 'admin'), status = coalesce(status, 'accepted');
alter table con_members alter column role set default 'editor';
alter table con_members alter column status set default 'pending';
alter table con_members alter column role set not null;
alter table con_members alter column status set not null;
alter table con_members drop constraint if exists con_members_role_check;
alter table con_members add constraint con_members_role_check check (role in ('admin','editor'));
alter table con_members drop constraint if exists con_members_status_check;
alter table con_members add constraint con_members_status_check check (status in ('pending','accepted'));

-- ---------- 2. is_con_member: akzeptierte Mitgliedschaft ODER Super-Admin ----------
-- Super-Admin bekommt dadurch automatisch "Durchgriffsrecht auf alles": jede
-- Regel, die is_con_member/is_con_admin nutzt (Räume, Tische, Zuordnungen,
-- Änderungswünsche, Crew-Verwaltung, Con umbenennen), greift ohne weitere
-- Änderungen auch für den Super-Admin, ganz ohne eigene con_members-Zeile.
create or replace function public.is_con_member(target_con uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1 from public.con_members
    where con_id = target_con and user_id = auth.uid() and status = 'accepted'
  );
$$;

-- ---------- 3. is_con_admin: zusätzlich role = 'admin' (oder Super-Admin) ----------
create or replace function public.is_con_admin(target_con uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1 from public.con_members
    where con_id = target_con and user_id = auth.uid() and status = 'accepted' and role = 'admin'
  );
$$;
revoke all on function public.is_con_admin(uuid) from public;
grant execute on function public.is_con_admin(uuid) to authenticated;

-- ---------- 4. Ersteller wird sofort akzeptierter Admin ----------
create or replace function public.add_creator_as_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.con_members (con_id, user_id, role, status)
  values (new.id, new.created_by, 'admin', 'accepted')
  on conflict (con_id, user_id) do nothing;
  return new;
end;
$$;

-- ---------- 5. Einladen: nur Admins, mit Rollenwahl, legt PENDING an ----------
-- Alte 2-Parameter-Version (ohne Rolle) explizit entfernen: sonst legt
-- "create or replace" eine ZWEITE, überladene Funktion parallel an, statt die
-- alte zu ersetzen (Postgres unterscheidet Funktionen nach Parameterliste),
-- und die alte Version würde weiterhin mit is_con_member statt is_con_admin
-- prüfen.
drop function if exists public.invite_member_to_con(uuid, text);
create or replace function public.invite_member_to_con(target_con uuid, invite_email text, invite_role text default 'editor')
returns void language plpgsql security definer set search_path = ''
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

-- ---------- 6. Einladung annehmen / ablehnen (nur die eingeladene Person selbst) ----------
create or replace function public.accept_invite(target_con uuid)
returns void language plpgsql security definer set search_path = ''
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
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.con_members
  where con_id = target_con and user_id = auth.uid() and status = 'pending';
end;
$$;
revoke all on function public.decline_invite(uuid) from public;
grant execute on function public.decline_invite(uuid) to authenticated;

-- ---------- 7. Eigene offene Einladungen auflisten ----------
create or replace function public.list_my_invites()
returns table(con_id uuid, con_name text, role text)
language sql stable security definer set search_path = ''
as $$
  select cm.con_id, c.name, cm.role
  from public.con_members cm
  join public.cons c on c.id = cm.con_id
  where cm.user_id = auth.uid() and cm.status = 'pending';
$$;
revoke all on function public.list_my_invites() from public;
grant execute on function public.list_my_invites() to authenticated;

-- ---------- 8. list_con_members: jetzt inkl. role/status ----------
-- Rückgabetyp ändert sich (neue Spalten) — Postgres verbietet das per
-- "create or replace", daher erst explizit droppen.
drop function if exists public.list_con_members(uuid);
create or replace function public.list_con_members(target_con uuid)
returns table(user_id uuid, email text, role text, status text)
language plpgsql security definer set search_path = ''
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

-- ---------- 9. Letzter-Admin-Schutz (ersetzt Letztes-Mitglied-Schutz) ----------
create or replace function public.prevent_removing_last_admin()
returns trigger language plpgsql security definer set search_path = ''
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

-- ---------- 10. Policies: Einladen/Entfernen/Rolle nur Admins, außer bei sich selbst ----------
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

-- Con umbenennen: jetzt Admin-only (statt jedes Mitglied)
drop policy if exists "members update own con" on cons;
drop policy if exists "admins update own con" on cons;
create policy "admins update own con" on cons for update to authenticated
  using (is_con_admin(id)) with check (is_con_admin(id));
