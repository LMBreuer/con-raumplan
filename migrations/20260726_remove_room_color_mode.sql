-- Run this only if the previous colour-mode SQL was already executed.
-- It removes the now-unused column; no rooms or other room data are deleted.
alter table public.rooms drop constraint if exists rooms_color_mode_check;
alter table public.rooms drop column if exists color_mode;
