-- =========================================================
--  ESQUEMA DE BASE DE DATOS - Portafolio Javiera Gurruchaga
--  Ejecutar en: Supabase Dashboard > SQL Editor
-- =========================================================

-- ---------------------------------------------------------
-- 1. TABLA: projects (proyectos del portafolio)
-- ---------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  images text[] default '{}',          -- URLs públicas de Supabase Storage
  videos text[] default '{}',          -- URLs de storage o embeds (YouTube/Canva)
  audios text[] default '{}',          -- URLs públicas de Supabase Storage
  links text[] default '{}',           -- enlaces externos adicionales
  views integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Lectura pública (cualquiera puede ver los proyectos)
create policy "Public read projects"
  on public.projects for select
  using (true);

-- Escritura solo para usuarios autenticados (panel admin)
create policy "Authenticated insert projects"
  on public.projects for insert
  to authenticated
  with check (true);

create policy "Authenticated update projects"
  on public.projects for update
  to authenticated
  using (true);

create policy "Authenticated delete projects"
  on public.projects for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------
-- 2. TABLA: site_settings (config del footer: instagram/email)
-- ---------------------------------------------------------
create table if not exists public.site_settings (
  id int primary key default 1,
  instagram_url text default 'https://instagram.com/',
  contact_email text default 'contacto@ejemplo.com',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into public.site_settings (id, instagram_url, contact_email)
values (1, 'https://instagram.com/javieragurruchaga', 'contacto@ejemplo.com')
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

create policy "Public read settings"
  on public.site_settings for select
  using (true);

create policy "Authenticated update settings"
  on public.site_settings for update
  to authenticated
  using (true);

-- ---------------------------------------------------------
-- 3. TABLA: site_visits (registro de visitas totales)
-- ---------------------------------------------------------
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

create policy "Public insert visits"
  on public.site_visits for insert
  to anon
  with check (true);

create policy "Authenticated read visits"
  on public.site_visits for select
  to authenticated
  using (true);

-- ---------------------------------------------------------
-- 4. TABLA: session_durations (tiempo de permanencia)
-- ---------------------------------------------------------
create table if not exists public.session_durations (
  id uuid primary key default gen_random_uuid(),
  duration_seconds integer not null,
  recorded_at timestamptz not null default now()
);

alter table public.session_durations enable row level security;

create policy "Public insert durations"
  on public.session_durations for insert
  to anon
  with check (true);

create policy "Authenticated read durations"
  on public.session_durations for select
  to authenticated
  using (true);

-- ---------------------------------------------------------
-- 5. FUNCIÓN: incrementar vistas de un proyecto de forma atómica
-- ---------------------------------------------------------
create or replace function public.increment_project_views(project_id uuid)
returns void as $$
begin
  update public.projects
  set views = views + 1
  where id = project_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_project_views(uuid) to anon, authenticated;

-- ---------------------------------------------------------
-- 6. STORAGE BUCKET
--    Crear manualmente en Dashboard > Storage:
--    Nombre: portafolio-media   |   Público: SI
--    O ejecutar (requiere permisos de servicio):
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('portafolio-media', 'portafolio-media', true)
on conflict (id) do nothing;

-- Políticas de Storage: lectura pública, escritura solo autenticados
create policy "Public read media"
  on storage.objects for select
  using (bucket_id = 'portafolio-media');

create policy "Authenticated upload media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portafolio-media');

create policy "Authenticated delete media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portafolio-media');

-- ---------------------------------------------------------
-- 7. USUARIOS ADMIN (Supabase Auth)
--    Crea estos usuarios manualmente en:
--    Dashboard > Authentication > Users > Add User
--
--    Email: santiagodelacarrera2018@gmail.com   | Password: d852401S
--    Email: Jgurruchagaz@icloud.com             | Password: Javiera2005@
--
--    (Supabase Auth requiere un email como identificador;
--     en el login de la app el usuario escribe "Admin" o "Javi"
--     y el frontend lo traduce internamente al email registrado)
-- ---------------------------------------------------------
