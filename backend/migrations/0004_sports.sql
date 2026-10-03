-- Sports catalogue. Adding a sport is a row here (set active = true to show
-- it in filters); no client changes are needed.
insert into public.sports (name, slug, icon, active, sort_order) values
  ('Basketball', 'basketball', 'Basketball', true, 10),
  ('Football',   'football',   'Football', true, 20),
  ('Volleyball', 'volleyball', 'Volleyball', true, 30),
  ('Tennis',     'tennis',     'Tennis', true, 40),
  ('Badminton',  'badminton',  'Badminton', true, 50)
on conflict (slug) do nothing;
