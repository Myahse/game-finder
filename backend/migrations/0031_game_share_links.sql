-- Short public tokens for sharing games (/g/{token}).

create table if not exists public.game_share_links (
  game_id uuid not null references public.games (id) on delete cascade,
  token text primary key,
  created_at timestamptz not null default now()
);

create unique index if not exists game_share_links_game_idx on public.game_share_links (game_id);

create or replace function public.ensure_game_share_link(p_game_id uuid)
returns text
language plpgsql
set search_path = public
as $ftg$
declare
  v_uid uuid := app_uid();
  v_token text;
  v_status public.game_status;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select g.status into v_status from public.games g where g.id = p_game_id;
  if v_status is null then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('scheduled', 'active') then
    raise exception 'game_not_open' using errcode = 'P0001';
  end if;

  select l.token into v_token
  from public.game_share_links l
  where l.game_id = p_game_id;

  if v_token is not null then
    return v_token;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.game_share_links (game_id, token) values (p_game_id, v_token);
  return v_token;
end;
$ftg$;

create or replace function public.get_game_share_preview(p_token text)
returns jsonb
language sql
stable
set search_path = public
as $ftg$
  select jsonb_build_object(
    'valid', true,
    'game_id', g.id,
    'status', g.status,
    'start_time', g.start_time,
    'court_name', c.name,
    'sport_name', s.name,
    'sport_slug', s.slug,
    'game_type', g.game_type
  )
  from public.game_share_links l
  join public.games g on g.id = l.game_id
  join public.courts c on c.id = g.court_id
  join public.sports s on s.id = g.sport_id
  where l.token = trim(p_token)
    and g.status in ('scheduled', 'active')
    and public.court_is_playable(c.status);
$ftg$;
