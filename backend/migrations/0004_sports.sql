-- Sports catalogue. Adding a sport is a row here (set active = true to show
-- it in filters); no client changes are needed.
insert into public.sports (name, slug, icon, active, sort_order) values
  ('Basketball', 'basketball', '🏀', true, 10),
  ('Football',   'football',   '⚽', false, 20),
  ('Volleyball', 'volleyball', '🏐', false, 30),
  ('Tennis',     'tennis',     '🎾', false, 40),
  ('Badminton',  'badminton',  '🏸', false, 50)
on conflict (slug) do nothing;
