-- Player language: notifications are written in the recipient's device language,
-- sport names follow the request's language (app.locale, from Accept-Language).

alter table public.users add column if not exists locale text not null default 'en'
  check (locale in ('en', 'fr'));

alter table public.sports add column if not exists name_fr text;
update public.sports set name_fr = case slug
  when 'basketball' then 'Basket-ball'
  when 'football' then 'Football'
  when 'volleyball' then 'Volley-ball'
  when 'tennis' then 'Tennis'
  when 'badminton' then 'Badminton'
  else name_fr end
where name_fr is null;

-- Language of the current request: app.locale, else the signed-in player's, else English.
create or replace function public.request_locale()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.locale', true), ''),
    (select u.locale from public.users u where u.id = public.app_uid()),
    'en'
  );
$$;

create or replace function public.sport_json(s public.sports)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', case when public.request_locale() = 'fr' then coalesce(s.name_fr, s.name) else s.name end,
    'slug', s.slug, 'icon', s.icon, 'active', s.active
  );
$$;

-- English sport name (as written in notification texts) → French.
create or replace function public.sport_name_fr(p_name text)
returns text
language sql
stable
as $$
  select case when lower(p_name) = 'pickup' then 'libre'
    else coalesce((select s.name_fr from public.sports s where lower(s.name) = lower(p_name)), p_name) end;
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
    ('Connector', 'Rassembleur'), ('Duelist', 'Duelliste'), ('Gunslinger', 'Fine gâchette')
  ) as b(en, fr) where b.en = p_name), p_name);
$$;

-- "now" / "at Tue 18:00 UTC" (challenge timing) → French.
create or replace function public.when_fr(p text)
returns text
language sql
immutable
as $$
  select case when p = 'now' then 'maintenant'
    else replace(replace(replace(replace(replace(replace(replace(
           regexp_replace(p, '^at ', 'le '),
           'Mon', 'lun.'), 'Tue', 'mar.'), 'Wed', 'mer.'), 'Thu', 'jeu.'), 'Fri', 'ven.'), 'Sat', 'sam.'), 'Sun', 'dim.')
  end;
$$;

-- French version of a notification written from the English templates.
-- Unknown texts are returned unchanged.
create or replace function public.notification_text_fr(p_title text, p_body text, out title text, out body text)
language plpgsql
stable
set search_path = public
as $$
declare
  m text[];
begin
  title := case p_title
    when 'Are you still playing?' then 'Vous jouez toujours ?'
    when 'Game reminder' then 'Rappel de match'
    when 'Game on nearby' then 'Match en cours près de vous'
    when 'Friend link accepted' then 'Lien d’ami accepté'
    when 'Game cancelled' then 'Match annulé'
    when 'Game invitation' then 'Invitation à un match'
    when 'Friend request accepted' then 'Demande d’ami acceptée'
    when 'Friend request' then 'Demande d’ami'
    when 'New court nearby' then 'Nouveau terrain près de vous'
    when 'Court sent for review' then 'Terrain renvoyé en vérification'
    when 'Court submitted for review' then 'Terrain envoyé pour vérification'
    when 'New game nearby' then 'Nouveau match près de vous'
    when 'New player' then 'Nouveau joueur'
    when 'Court to review' then 'Terrain à vérifier'
    when 'New friend' then 'Nouvel ami'
    when 'King of the Court 👑' then 'Roi du terrain 👑'
    when 'Challenge cancelled' then 'Défi annulé'
    when 'Confirm the result' then 'Confirmez le résultat'
    when 'Result disputed' then 'Résultat contesté'
    when 'Notifications are on 🎉' then 'Notifications activées 🎉'
    else p_title
  end;
  if title = p_title then
    m := regexp_match(p_title, '^New badge: (.*)$');
    if m is not null then title := 'Nouveau badge : ' || badge_name_fr(m[1]); end if;
    m := regexp_match(p_title, '^🔥 (\d+)-week streak$');
    if m is not null then title := '🔥 Série de ' || m[1] || ' semaines'; end if;
    m := regexp_match(p_title, '^⚔️ (.*) challenges you$');
    if m is not null then title := '⚔️ ' || m[1] || ' vous défie'; end if;
    m := regexp_match(p_title, '^⚔️ Open challenge at (.*)$');
    if m is not null then title := '⚔️ Défi ouvert à ' || m[1]; end if;
    m := regexp_match(p_title, '^(.*) declined your challenge$');
    if m is not null then title := m[1] || ' a refusé votre défi'; end if;
    m := regexp_match(p_title, '^🔥 (.*) accepted your challenge$');
    if m is not null then title := '🔥 ' || m[1] || ' a accepté votre défi'; end if;
  end if;

  body := p_body;
  m := regexp_match(p_body, '^Are you still playing at (.*)\?$');
  if m is not null then body := 'Vous jouez toujours à ' || m[1] || ' ?'; return; end if;
  m := regexp_match(p_body, '^(.*) game at (.*) starts in (\d+) minutes\.$');
  if m is not null then body := 'Le match de ' || sport_name_fr(m[1]) || ' à ' || m[2] || ' commence dans ' || m[3] || ' minutes.'; return; end if;
  m := regexp_match(p_body, '^A game is active (.*) km from you at (.*)\.$');
  if m is not null then body := 'Un match est en cours à ' || m[1] || ' km de vous, à ' || m[2] || '.'; return; end if;
  m := regexp_match(p_body, '^(.*) joined via your invite link\.$');
  if m is not null then body := m[1] || ' a rejoint via votre lien d’invitation.'; return; end if;
  m := regexp_match(p_body, '^The game at (.*) was cancelled\.$');
  if m is not null then body := 'Le match à ' || m[1] || ' a été annulé.'; return; end if;
  m := regexp_match(p_body, '^(.*) invited you to a (.*) game at (.*)\.$');
  if m is not null then body := m[1] || ' vous invite à un match de ' || sport_name_fr(m[2]) || ' à ' || replace(m[3], 'a court', 'un terrain') || '.'; return; end if;
  m := regexp_match(p_body, '^(.*) accepted your friend request\.$');
  if m is not null then body := m[1] || ' a accepté votre demande d’ami.'; return; end if;
  m := regexp_match(p_body, '^(.*) wants to be friends\.$');
  if m is not null then body := m[1] || ' veut devenir votre ami.'; return; end if;
  m := regexp_match(p_body, '^“(.*)” was added (.*) km from you\.$');
  if m is not null then body := '« ' || m[1] || ' » a été ajouté à ' || m[2] || ' km de vous.'; return; end if;
  m := regexp_match(p_body, '^(.*) is now on the map \((.*) km away\)\.$');
  if m is not null then body := m[1] || ' est maintenant sur la carte (à ' || m[2] || ' km).'; return; end if;
  m := regexp_match(p_body, '^“(.*)” was moved back to review\. It is hidden from the map until approved\.$');
  if m is not null then body := '« ' || m[1] || ' » est de nouveau en vérification. Il est masqué de la carte jusqu’à validation.'; return; end if;
  m := regexp_match(p_body, '^We received your proposal for “(.*)”\. It is hidden from the public map until an admin approves it\.$');
  if m is not null then body := 'Nous avons reçu votre proposition « ' || m[1] || ' ». Elle est masquée de la carte jusqu’à la validation d’un admin.'; return; end if;
  m := regexp_match(p_body, '^(.*) started a (.*) game at (.*) \((.*) km\)\.$');
  if m is not null then body := m[1] || ' a lancé un match de ' || sport_name_fr(m[2]) || ' à ' || m[3] || ' (' || m[4] || ' km).'; return; end if;
  m := regexp_match(p_body, '^New (.*) game at (.*) \((.*) km\)\.$');
  if m is not null then body := 'Nouveau match de ' || sport_name_fr(m[1]) || ' à ' || m[2] || ' (' || m[3] || ' km).'; return; end if;
  m := regexp_match(p_body, '^(.*) signed up\.$');
  if m is not null then body := m[1] || ' s’est inscrit.'; return; end if;
  m := regexp_match(p_body, '^New proposal: (.*)\.$');
  if m is not null then body := 'Nouvelle proposition : ' || m[1] || '.'; return; end if;
  m := regexp_match(p_body, '^(.*) proposed (.*)\.$');
  if m is not null then body := m[1] || ' a proposé ' || m[2] || '.'; return; end if;
  m := regexp_match(p_body, '^(.*) connected with you on court\.$');
  if m is not null then body := m[1] || ' s’est connecté avec vous sur le terrain.'; return; end if;
  m := regexp_match(p_body, '^You unlocked the "(.*)" badge\. Share it with your crew!$');
  if m is not null then body := 'Vous avez débloqué le badge « ' || badge_name_fr(m[1]) || ' ». Partagez-le avec votre équipe !'; return; end if;
  m := regexp_match(p_body, '^You were #1 at (.*) last week\. The crown is yours this week!$');
  if m is not null then body := 'Vous étiez n°1 à ' || m[1] || ' la semaine dernière. La couronne est à vous cette semaine !'; return; end if;
  if p_body = 'Your streak ends Sunday. Play or check in at a court this weekend to keep it alive.' then
    body := 'Votre série se termine dimanche. Jouez ou faites un check-in ce week-end pour la garder.'; return;
  end if;
  m := regexp_match(p_body, '^At (.*) (now|at .*)\. Accept or decline\.$');
  if m is not null then body := 'À ' || m[1] || ' ' || when_fr(m[2]) || '. Acceptez ou refusez.'; return; end if;
  m := regexp_match(p_body, '^(.*) is looking for an opponent (now|at .*)\. First to accept plays\.$');
  if m is not null then body := m[1] || ' cherche un adversaire ' || when_fr(m[2]) || '. Le premier qui accepte joue.'; return; end if;
  if p_body = 'Maybe next time. Try someone else?' then body := 'Ce sera pour une prochaine fois. Défiez quelqu’un d’autre ?'; return; end if;
  if p_body = 'Game on! See you at the court.' then body := 'C’est parti ! Rendez-vous au terrain.'; return; end if;
  m := regexp_match(p_body, '^(.*) cancelled the challenge\.$');
  if m is not null then body := m[1] || ' a annulé le défi.'; return; end if;
  m := regexp_match(p_body, '^(.*) reported a win for you\. Confirm or dispute within 24 h\.$');
  if m is not null then body := m[1] || ' a saisi une victoire pour vous. Confirmez ou contestez sous 24 h.'; return; end if;
  m := regexp_match(p_body, '^(.*) reported a win for them\. Confirm or dispute within 24 h\.$');
  if m is not null then body := m[1] || ' a saisi sa victoire. Confirmez ou contestez sous 24 h.'; return; end if;
  m := regexp_match(p_body, '^(.*) disputed the result\. Report it again together\.$');
  if m is not null then body := m[1] || ' a contesté le résultat. Saisissez-le à nouveau ensemble.'; return; end if;
end;
$$;

create or replace function public.trg_localize_notification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if (select u.locale from users u where u.id = new.user_id) = 'fr' then
    select t.title, t.body into v_title, v_body from notification_text_fr(new.title, new.body) t;
    new.title := coalesce(v_title, new.title);
    new.body := coalesce(v_body, new.body);
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_localize on public.notifications;
create trigger notifications_localize
  before insert on public.notifications
  for each row execute function public.trg_localize_notification();
