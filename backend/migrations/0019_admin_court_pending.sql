-- Let admins move approved/rejected courts back to pending review.

create or replace function public.admin_review_court(
  p_court_id uuid,
  p_approve boolean,
  p_reason text default null,
  p_pending boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_admin();
  if p_pending then
    update public.courts
    set status = 'pending'::public.court_status,
        rejection_reason = null,
        reviewed_by = null,
        reviewed_at = null
    where id = p_court_id;
  else
    update public.courts
    set status = case when p_approve then 'approved' else 'rejected' end::public.court_status,
        rejection_reason = case when p_approve then null else nullif(trim(p_reason), '') end,
        reviewed_by = app_uid(),
        reviewed_at = now()
    where id = p_court_id;
  end if;
  if not found then
    raise exception 'court_not_found' using errcode = 'P0001';
  end if;
end;
$$;
