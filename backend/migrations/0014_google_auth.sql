-- Google Sign-In.
-- Accounts created with Google have no password; google_sub (Google's stable
-- account id) links a user to their Google account.

alter table public.users alter column password_hash drop not null;
alter table public.users add column google_sub text;
create unique index users_google_sub_idx on public.users (google_sub) where google_sub is not null;

-- Some Google accounts have no family name.
alter table public.users drop constraint users_last_name_check;
alter table public.users add constraint users_last_name_check check (char_length(last_name) <= 50);
