-- Test-only court fixtures (see api_test setup). Not used in production.
with c (name, lat, lng, address, surface, lighting, hours) as (
  values
    ('Terrain IUGB',               5.2133, -3.7389, 'International University of Grand-Bassam, Grand-Bassam', 'Concrete', true,  '06:00–22:00'),
    ('Terrain Quartier France',    5.1995, -3.7362, 'Quartier France, Grand-Bassam',                          'Concrete', false, 'Open 24h'),
    ('Terrain Mockeyville',        5.2052, -3.7580, 'Mockeyville, Grand-Bassam',                              'Asphalt',  false, 'Open 24h'),
    ('Terrain Cocody',             5.3483, -3.9870, 'Cocody, Abidjan',                                        'Acrylic',  true,  '07:00–23:00'),
    ('Terrain Marcory Zone 4',     5.2960, -3.9760, 'Zone 4, Marcory, Abidjan',                               'Concrete', true,  '06:00–22:00'),
    ('Terrain Plateau',            5.3237, -4.0175, 'Le Plateau, Abidjan',                                    'Asphalt',  true,  '06:00–21:00'),
    ('Terrain Yopougon Selmer',    5.3352, -4.0753, 'Selmer, Yopougon, Abidjan',                              'Concrete', false, 'Open 24h'),
    ('Terrain Bingerville',        5.3550, -3.8853, 'Bingerville',                                            'Concrete', false, '06:00–20:00')
),
ins as (
  insert into public.courts (name, latitude, longitude, address, surface, lighting, opening_hours, status, description)
  select name, lat, lng, address, surface, lighting, hours, 'approved', 'Outdoor public court.'
  from c
  where not exists (select 1 from public.courts x where x.name = c.name)
  returning id
)
insert into public.court_sports (court_id, sport_id)
select ins.id, s.id from ins, public.sports s where s.slug = 'basketball'
on conflict do nothing;
