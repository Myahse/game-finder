-- New badge: Goatee (the GOAT) — King of the Court 3 times.

create or replace function public.badge_defs()
returns table (id text, metric text, goal int, ord int, name text)
language sql
immutable
as $$
  values
    ('first_game', 'games', 1, 1, 'First game'),
    ('games_10', 'games', 10, 2, '10 games'),
    ('games_50', 'games', 50, 3, '50 games'),
    ('games_100', 'games', 100, 4, '100 games'),
    ('first_win', 'wins', 1, 5, 'First win'),
    ('wins_10', 'wins', 10, 6, '10 wins'),
    ('first_mvp', 'mvps', 1, 7, 'First MVP'),
    ('mvp_5', 'mvps', 5, 8, '5× MVP'),
    ('host_5', 'hosted', 5, 9, 'Host'),
    ('courts_5', 'courts', 5, 10, 'Explorer'),
    ('early_bird', 'early', 1, 11, 'Early bird'),
    ('night_owl', 'night', 1, 12, 'Night owl'),
    ('rain_player', 'rain', 1, 13, 'Played in the rain'),
    ('streak_4', 'best_streak', 4, 14, '4-week streak'),
    ('king', 'kings', 1, 15, 'King of the Court'),
    ('social_10', 'friends', 10, 16, 'Connector'),
    ('duelist', 'challenge_wins', 1, 17, 'Duelist'),
    ('gunslinger', 'challenge_wins', 10, 18, 'Gunslinger'),
    ('goatee', 'kings', 3, 19, 'Goatee')
$$;

create or replace function public.badge_name_fr(p_name text)
returns text
language sql
immutable
as $$
  select coalesce((select fr from (values
    ('First game', 'Premier match'), ('10 games', '10 matchs'), ('50 games', '50 matchs'), ('100 games', '100 matchs'),
    ('First win', 'Première victoire'), ('10 wins', '10 victoires'), ('First MVP', 'Premier MVP'), ('5× MVP', '5× MVP'),
    ('Host', 'Organisateur'), ('Explorer', 'Explorateur'), ('Early bird', 'Lève-tôt'), ('Night owl', 'Oiseau de nuit'),
    ('Played in the rain', 'Sous la pluie'), ('4-week streak', 'En feu'), ('King of the Court', 'Roi du terrain'),
    ('Connector', 'Rassembleur'), ('Duelist', 'Duelliste'), ('Gunslinger', 'Fine gâchette'),
    ('Goatee', 'Goatee')
  ) as b(en, fr) where b.en = p_name), p_name);
$$;
