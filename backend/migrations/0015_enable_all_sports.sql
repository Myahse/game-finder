-- Enable football, volleyball, tennis, and badminton in filters and onboarding.
update public.sports
set active = true
where slug in ('football', 'volleyball', 'tennis', 'badminton')
  and not active;
