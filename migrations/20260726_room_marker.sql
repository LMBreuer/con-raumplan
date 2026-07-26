-- Additive migration: stores an optional, fixed symbol for the contrast
-- colour-vision aid. NULL keeps the previous automatic assignment.
alter table public.rooms add column if not exists marker text;

alter table public.rooms drop constraint if exists rooms_marker_check;
alter table public.rooms add constraint rooms_marker_check
  check (marker is null or marker in ('circle', 'triangle', 'square', 'diamond', 'plus', 'cross', 'hexagon', 'star', 'sparkle', 'sun', 'moon', 'cloud', 'flower', 'tree', 'heart', 'flag', 'key', 'book', 'music', 'bulb', 'letter', 'dice', 'invader', 'wc', 'kitchen', 'door', 'coat', 'toy'));

comment on column public.rooms.marker is
  'Optional fixed symbol for the contrast colour-vision aid; NULL uses the automatic room-order symbol.';
