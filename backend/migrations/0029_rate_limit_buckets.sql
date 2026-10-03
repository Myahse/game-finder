-- Shared rate limits across API instances (fixed windows).

create table if not exists public.rate_limit_buckets (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, key, window_start)
);

create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);

create or replace function public.rate_limit_allow(
  p_bucket text,
  p_key text,
  p_max int,
  p_window_secs int
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_start timestamptz;
  v_count int;
begin
  if p_key is null or p_key = '' or p_max <= 0 then
    return true;
  end if;
  v_start := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_window_secs, 1)) * greatest(p_window_secs, 1)
  );
  insert into rate_limit_buckets as b (bucket, key, window_start, count)
  values (p_bucket, p_key, v_start, 1)
  on conflict (bucket, key, window_start)
  do update set count = rate_limit_buckets.count + 1
  returning count into v_count;
  delete from rate_limit_buckets where window_start < now() - interval '2 hours';
  return v_count <= p_max;
end;
$$;
