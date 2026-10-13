-- InvoPro V15: run this in Supabase SQL Editor
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'User' check (role in ('Admin','Staff','User')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null,
  doc_number text not null,
  status text not null default 'Draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists documents_user_number_idx on public.documents(user_id, doc_number);
create index if not exists documents_user_idx on public.documents(user_id, created_at desc);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id,email,name,role,active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1), 'User'),
    case when not exists (select 1 from public.profiles) then 'Admin' else 'User' end,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.user_settings enable row level security;

revoke all on public.profiles from anon;
revoke all on public.documents from anon;
revoke all on public.user_settings from anon;

grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.documents to authenticated;
grant select,insert,update,delete on public.user_settings to authenticated;

-- Every signed-in user can read only their own profile.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
for select to authenticated
using (id = auth.uid());

-- A document belongs to the signed-in user.
drop policy if exists "read own docs" on public.documents;
create policy "read own docs" on public.documents for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert own docs" on public.documents;
create policy "insert own docs" on public.documents for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update own docs" on public.documents;
create policy "update own docs" on public.documents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own docs" on public.documents;
create policy "delete own docs" on public.documents for delete to authenticated using (user_id = auth.uid());

-- Settings belong to the signed-in user.
drop policy if exists "read own settings" on public.user_settings;
create policy "read own settings" on public.user_settings for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert own settings" on public.user_settings;
create policy "insert own settings" on public.user_settings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update own settings" on public.user_settings;
create policy "update own settings" on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own settings" on public.user_settings;
create policy "delete own settings" on public.user_settings for delete to authenticated using (user_id = auth.uid());
