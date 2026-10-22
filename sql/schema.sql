-- Ejecutar en Supabase SQL Editor. Revise cada identificador antes de ejecutar.
-- Este esquema no crea usuarios ni contraseñas: créelos en Authentication.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.admin_users enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 160),
 description text not null check (char_length(description) <= 5000), category text not null check (char_length(category) <= 100),
 role text, year text, tools text, credits text, rights text, images text[] not null default '{}', videos text[] not null default '{}', audios text[] not null default '{}', links text[] not null default '{}', created_at timestamptz not null default now()
);
alter table public.projects add column if not exists role text;
alter table public.projects add column if not exists year text;
alter table public.projects add column if not exists tools text;
alter table public.projects add column if not exists credits text;
alter table public.projects add column if not exists rights text;
alter table public.projects add column if not exists video_assets jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists views integer not null default 0;
-- Preserve existing public projects once; new projects start as drafts.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'published') then
    alter table public.projects add column published boolean not null default true;
    alter table public.projects alter column published set default false;
  end if;
end $$;
alter table public.projects enable row level security;
drop policy if exists "Public read projects" on public.projects; drop policy if exists "Authenticated insert projects" on public.projects; drop policy if exists "Authenticated update projects" on public.projects; drop policy if exists "Authenticated delete projects" on public.projects;
drop policy if exists "public reads projects" on public.projects; drop policy if exists "admins manage projects" on public.projects;
create policy "public reads projects" on public.projects for select using (published = true);
create policy "admins manage projects" on public.projects for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table if not exists public.site_settings (id int primary key default 1 check(id=1), instagram_url text, contact_email text, updated_at timestamptz not null default now());
alter table public.site_settings enable row level security;
drop policy if exists "Public read settings" on public.site_settings; drop policy if exists "Authenticated update settings" on public.site_settings;
drop policy if exists "public reads settings" on public.site_settings; drop policy if exists "admins update settings" on public.site_settings;
create policy "public reads settings" on public.site_settings for select using (true);
create policy "admins update settings" on public.site_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());

create table if not exists public.contact_messages (id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 100), email text not null check(char_length(email)<=254), message text not null check(char_length(message) between 1 and 2000), created_at timestamptz not null default now());
alter table public.contact_messages enable row level security;
-- Historical messages remain for manual retention management; the site no longer writes here.
-- Revoke browser grants even if an older deployment left policies behind.
revoke all on public.contact_messages from anon, authenticated;

-- Retire la analítica anterior sin consentimiento: RLS sigue activa y al eliminar
-- estas políticas se bloquean nuevas inserciones/lecturas desde el navegador.
do $$ begin
  if to_regclass('public.site_visits') is not null then
    execute 'drop policy if exists "Public insert visits" on public.site_visits';
    execute 'drop policy if exists "Authenticated read visits" on public.site_visits';
    execute 'drop policy if exists "admins read visits" on public.site_visits';
    execute 'create policy "admins read visits" on public.site_visits for select to authenticated using (private.is_admin())';
  end if;
  if to_regclass('public.session_durations') is not null then
    execute 'drop policy if exists "Public insert durations" on public.session_durations';
    execute 'drop policy if exists "Authenticated read durations" on public.session_durations';
    execute 'drop policy if exists "admins read durations" on public.session_durations';
    execute 'create policy "admins read durations" on public.session_durations for select to authenticated using (private.is_admin())';
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'portafolio-media', 'portafolio-media', true, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/x-wav'
  ]::text[]
) on conflict(id) do nothing;
drop policy if exists "Public read media" on storage.objects; drop policy if exists "Authenticated upload media" on storage.objects; drop policy if exists "Authenticated delete media" on storage.objects;
drop policy if exists "public reads portfolio media" on storage.objects; drop policy if exists "admins upload portfolio media" on storage.objects; drop policy if exists "admins update portfolio media" on storage.objects; drop policy if exists "admins delete portfolio media" on storage.objects;
create policy "public reads portfolio media" on storage.objects for select using (bucket_id='portafolio-media');
create policy "admins upload portfolio media" on storage.objects for insert to authenticated with check (bucket_id='portafolio-media' and private.is_admin());
create policy "admins update portfolio media" on storage.objects for update to authenticated using (bucket_id='portafolio-media' and private.is_admin()) with check (bucket_id='portafolio-media' and private.is_admin());
create policy "admins delete portfolio media" on storage.objects for delete to authenticated using (bucket_id='portafolio-media' and private.is_admin());

-- Previous deployments exposed public.is_admin() as RPC. Retire its browser grants.
do $$ begin
  if to_regprocedure('public.is_admin()') is not null then
    execute 'revoke all on function public.is_admin() from public, anon, authenticated';
  end if;
end $$;

-- Después de crear los usuarios de Auth, registre explícitamente cada administrador:
-- insert into public.admin_users(user_id) values ('UUID-DE-AUTH-DEL-ADMIN');
-- Las tablas históricas site_visits y session_durations no se usan ni reciben datos nuevos.
