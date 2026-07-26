-- Optional room base colour. Safe for existing installations: no rows are
-- deleted or overwritten; NULL keeps the application fallback palette.
alter table public.rooms add column if not exists color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rooms_color_hex_check'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms add constraint rooms_color_hex_check
      check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

comment on column public.rooms.color is
  'Optional six-digit room base colour, e.g. #4F86F7.';
