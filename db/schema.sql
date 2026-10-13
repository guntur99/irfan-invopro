create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null default 'User',
  active boolean not null default true,
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table users add column if not exists email_verified_at timestamptz;
alter table users drop constraint if exists users_role_check;
update users set role='User' where role not in ('Owner','User');
alter table users add constraint users_role_check check (role in ('Owner','User'));
-- Akun lama dianggap sudah terverifikasi agar migrasi tidak mengunci user existing.
update users set email_verified_at=created_at where email_verified_at is null and created_at < now();

create unique index if not exists users_email_idx on users (lower(email));

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists email_verification_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_user_idx on email_verification_tokens (user_id);

create table if not exists documents (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  doc_type text not null,
  doc_number text not null,
  status text not null default 'Draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists documents_user_number_idx on documents (user_id, doc_number);
create index if not exists documents_user_idx on documents (user_id, created_at desc);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
