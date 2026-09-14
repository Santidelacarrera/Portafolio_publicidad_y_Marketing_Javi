# Portafolio Javiera Gurruchaga

Sitio web de portafolio (publicidad y marketing) con panel de administración
propio, construido con **HTML + Tailwind CSS + JavaScript vanilla**, e
integrado con **Supabase** (base de datos, autenticación y almacenamiento de
archivos). Sitio 100% estático, listo para desplegar en **Netlify** sin build.

## Estructura

```
├── index.html          # Vista pública (galería de proyectos)
├── login.html          # Login del panel admin
├── admin.html          # Panel de administración (CMS)
├── css/styles.css       # Estilos complementarios a Tailwind
├── js/
│   ├── config.js         # ⚠️ Acá van tus credenciales de Supabase
│   ├── supabaseClient.js # Cliente Supabase + helper de subida de archivos
│   ├── auth.js           # Login/logout con Supabase Auth
│   ├── main.js           # Lógica del sitio público
│   └── admin.js          # Lógica del panel admin (CRUD, stats, contacto)
├── sql/schema.sql       # Script SQL para crear tablas, policies y bucket
└── netlify.toml         # Configuración de despliegue en Netlify
```

## 1. Configurar Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Andá a **SQL Editor** y ejecutá el contenido de [sql/schema.sql](sql/schema.sql).
   Esto crea las tablas `projects`, `site_settings`, `site_visits`,
   `session_durations`, la función `increment_project_views`, el bucket de
   Storage `portafolio-media` y todas las políticas de seguridad (RLS).
3. Si el bucket no se crea automáticamente por permisos, creálo a mano en
   **Storage > New Bucket**: nombre `portafolio-media`, marcado como **Public**.
4. Andá a **Authentication > Users > Add user** y creá los dos usuarios admin:
   - `santiagodelacarrera2018@gmail.com` / `d852401S`
   - `Jgurruchagaz@icloud.com` / `Javiera2005@`

   En el login de la web se ingresa como usuario `Admin` o `Javi` (el
   frontend traduce internamente al email registrado, ver [js/auth.js](js/auth.js)).

5. Copiá tu **Project URL** y **anon public key** desde
   **Project Settings > API**.

## 2. Configurar las credenciales en el proyecto

Editá [js/config.js](js/config.js) y reemplazá:

```js
const SUPABASE_CONFIG = {
  URL: "https://TU-PROYECTO.supabase.co",
  ANON_KEY: "TU-ANON-KEY-PUBLICA-AQUI",
  BUCKET: "portafolio-media",
};
```

## 3. Probar en local

No requiere instalación ni build. Basta con servir los archivos estáticos,
por ejemplo:

```bash
npx serve .
# o
python -m http.server 5500
```

Abrí `http://localhost:5500` para el sitio público y
`http://localhost:5500/login.html` para entrar al panel admin.

## 4. Desplegar en Netlify

**Opción A — Arrastrar y soltar:** Andá a [app.netlify.com/drop](https://app.netlify.com/drop)
y arrastrá la carpeta del proyecto.

**Opción B — Conectado a Git (recomendado):**
1. Subí el proyecto a un repositorio de GitHub/GitLab.
2. En Netlify: **Add new site > Import an existing project**.
3. Build command: dejar vacío (o el que aparece en `netlify.toml`).
4. Publish directory: `.` (raíz del proyecto).
5. Deploy 🚀

El archivo [netlify.toml](netlify.toml) ya incluye redirects amigables
(`/admin`, `/login`).

## Funcionalidades

### Vista pública
- Galería dinámica de proyectos consultada en tiempo real desde Supabase.
- Filtro por categoría.
- Modal de detalle con imágenes, videos (archivo o embed de YouTube/Canva) y audios.
- Footer con Instagram y correo, editables desde el panel admin.
- Registro de visitas y tiempo de permanencia para estadísticas.

### Panel Admin (`/login.html` → `/admin.html`)
- Login con Supabase Auth (usuarios `Admin` / `Javi`).
- CRUD completo de proyectos, con subida automática de archivos a Supabase Storage.
- Módulo de estadísticas: visitas totales, tiempo promedio de permanencia,
  cantidad de proyectos y vistas por proyecto.
- Configuración de Instagram y correo de contacto del footer.

## Notas de seguridad

- La `anon key` es segura de exponer en el frontend: el acceso real está
  controlado por las **Row Level Security policies** definidas en
  `sql/schema.sql` (lectura pública, escritura solo para usuarios autenticados).
- Las contraseñas de los usuarios admin viven en Supabase Auth, no en el código.
