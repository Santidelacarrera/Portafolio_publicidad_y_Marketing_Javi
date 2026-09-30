# Portafolio Javiera Gurruchaga

Portafolio público y panel privado para publicar proyectos de dirección de arte, publicidad y marketing. Es una aplicación estática en HTML, CSS y JavaScript: Netlify la sirve y Supabase aporta autenticación, PostgreSQL con RLS y Storage. Una Netlify Function recibe el formulario de contacto con privilegios exclusivamente del lado servidor.

## Arquitectura

```text
Navegador
 ├─ Sitio público: index.html + js/main.js
 ├─ Acceso y panel: login.html / admin.html + js/auth.js / js/admin.js
 ├─ Supabase JS (CDN) ──► Auth, PostgreSQL/RLS y Storage
 └─ POST /.netlify/functions/contact ──► Netlify Function ──► contact_messages
```

El frontend usa la clave anónima/publicable de Supabase. La autorización efectiva no depende de ocultar controles en el navegador: la aplican Supabase Auth, RLS y las policies de Storage.

## Stack

| Área | Implementación |
| --- | --- |
| Interfaz | HTML5, CSS3 y JavaScript sin framework de aplicación |
| UI del panel | Tailwind CSS vía CDN |
| Cliente de datos | `@supabase/supabase-js@2` vía CDN |
| Videos grandes | `tus-js-client@4.3.1` vía CDN |
| Backend | Supabase Auth, PostgreSQL, RLS y Storage |
| Hosting/serverless | Netlify y una función JavaScript |
| Automatización | GitHub Actions: health check de Supabase |

No existe `package.json`, lockfile ni paso de compilación de la aplicación. `netlify.toml` publica la raíz y ejecuta un comando informativo.

## Estructura

```text
/
├── index.html                 # Portafolio público y contacto
├── login.html                 # Acceso privado
├── admin.html                 # Panel de administración
├── cookies.html               # Páginas legales
├── privacidad.html
├── terminos.html
├── reembolsos.html
├── _headers                   # CSP y cabeceras HTTP
├── netlify.toml               # Publicación, functions y redirects
├── robots.txt
├── sitemap.xml
├── css/
│   └── styles.css
├── js/
│   ├── config.js              # Configuración pública y nombres de tablas
│   ├── supabaseClient.js      # Cliente, Storage y carga TUS
│   ├── auth.js                # Sesión, login y logout
│   ├── main.js                # Render público, modal y contacto
│   └── admin.js               # CRUD, media, ajustes y estadísticas
├── sql/
│   └── schema.sql             # Esquema, RLS y policies
├── netlify/functions/
│   └── contact.js             # Inserción server-side de mensajes
└── .github/workflows/
    └── supabase-keepalive.yml
```

## Frontend

`index.html` carga Supabase, `js/config.js`, `js/supabaseClient.js` y `js/main.js`, en ese orden. `main.js` consulta `projects` por fecha, crea tarjetas mediante APIs del DOM, filtra por categoría y abre un `<dialog>` con el detalle. Valida URLs HTTP(S), usa `images`, `video_assets`, `videos`, `audios` y metadatos editoriales, y muestra estados de carga, vacío y error.

El formulario público hace `POST` a `/.netlify/functions/contact`. La preferencia de cookies se guarda en `localStorage`; no hay analítica ni marketing implementados.

El panel usa `requireAuth()` para redirigir si no existe sesión. Esa redirección es solo UX: la autorización real pertenece a Auth, RLS y Storage Policies.

## Supabase

### Configuración pública

`js/config.js` define `SUPABASE_CONFIG`:

- `URL`: URL pública del proyecto;
- `ANON_KEY`: clave anónima/publicable;
- `BUCKET`: `portafolio-media`;
- `TABLES`: `projects`, `site_settings`, `site_visits` y `session_durations`.

La URL y la `SUPABASE_ANON_KEY` pueden estar en el frontend. Nunca incluya una Service Role Key en HTML, CSS o JavaScript que llegue al navegador.

### Auth y autorización

`loginWithEmail()` usa `supabaseClient.auth.signInWithPassword`; `getCurrentSession()`, `requireAuth()` y `logout()` administran la sesión. Las cuentas se crean en Supabase Authentication, no mediante `schema.sql`.

El esquema registra administradores en `public.admin_users` y define `public.is_admin()`, una función `SECURITY DEFINER` para el usuario autenticado. La función se usa en las policies administrativas.

### PostgreSQL y RLS

`sql/schema.sql` habilita RLS y declara:

| Recurso | Acceso definido |
| --- | --- |
| `admin_users` | Lista de UUIDs de administradores; RLS habilitado |
| `projects` | Lectura pública; CRUD para administradores autenticados |
| `site_settings` | Lectura pública; actualización para administradores |
| `contact_messages` | Sin acceso desde navegador; inserta la Function server-side |
| `is_admin()` | Comprobación de privilegio administrativo |

`projects` contiene título, descripción, categoría, metadatos editoriales, arrays de media/enlaces, `video_assets` JSONB, `views` y `created_at`. `site_settings` usa el registro `id = 1` para Instagram y correo.

Las tablas históricas `site_visits` y `session_durations` no se crean en el esquema; si existen, el script limita su lectura a administradores. `admin.js` todavía las consulta para estadísticas. Si no existen, el panel registra el error y usa valores de respaldo: confirme su modelo de datos antes de depender de esas métricas.

### Storage

El bucket público `portafolio-media` sirve recursos del portafolio. El esquema declara estas policies sobre `storage.objects`:

| Operación | Regla |
| --- | --- |
| `SELECT` | Lectura pública en `portafolio-media` |
| `INSERT` | Usuario autenticado y `is_admin()` |
| `UPDATE` | Usuario autenticado y `is_admin()` |
| `DELETE` | Usuario autenticado y `is_admin()` |

No convierta la escritura en pública ni use una Service Role Key en el cliente.

## Administración y media

El panel crea, edita y elimina filas de `projects`, modifica `site_settings` y consulta estadísticas. Al editar conserva media existente y agrega la nueva. Eliminar una fila no elimina automáticamente sus objetos de Storage; revise periódicamente archivos huérfanos.

`js/supabaseClient.js` genera rutas como `images/<timestamp>_<nombre-saneado>` y devuelve URL pública tras una carga correcta:

- imágenes y audio usan `uploadFileToStorage()` con `upsert: false`;
- videos MP4, WebM y MOV de hasta 6 MiB usan upload convencional con `upsert: true`;
- videos mayores usan TUS con sesión autenticada, reintentos, chunks de 6 MiB, progreso y reanudación;
- `admin.js` procesa cargas del mismo tipo con `Promise.all()` y guarda el proyecto al completarlas.

Revise los logs del navegador ante errores de upload, sin mostrar datos internos a visitantes.

## Netlify y contacto

`netlify.toml` publica `.` y toma functions de `netlify/functions`. Define `/admin` → `/admin.html` y `/login` → `/login.html`.

La única Function, `contact.js`, recibe JSON, descarta el honeypot `company`, valida nombre, correo, mensaje y consentimiento, y escribe en `contact_messages`. Requiere estas variables en Netlify:

| Variable | Uso | Tratamiento |
| --- | --- | --- |
| `SUPABASE_URL` | Function de contacto | Configuración server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Function de contacto | Secreto privilegiado, exclusivamente server-side |

La función no concede acceso de navegador a `contact_messages` y devuelve respuestas genéricas. No implementa rate limiting actualmente; añádalo en una mejora separada si el volumen o abuso lo exige.

`_headers` define CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options`. Pruebe Supabase, Storage, media, fuentes, embeds y la Function tras cambiar la CSP.

## GitHub Actions

`.github/workflows/supabase-keepalive.yml` se ejecuta manualmente o cada tres días y consulta disponibilidad de `projects`. Usa los secretos de Actions `SUPABASE_URL` y `SUPABASE_ANON_KEY`; el workflow no contiene sus valores.

## Desarrollo local

1. Sirva la raíz con un servidor HTTP estático; no use `file://`.
2. Para Functions, use Netlify CLI si está disponible; para frontend basta un servidor estático.
3. Configure variables server-side fuera de Git.
4. Ejecute `sql/schema.sql` conscientemente en Supabase SQL Editor y registre UUIDs administrativos después de crearlos en Auth.
5. Pruebe portafolio, login, CRUD, uploads, ajustes y contacto antes de desplegar.

```bash
node --check js/main.js
node --check js/supabaseClient.js
git diff --check
git status
```

## Deploy y flujo Git

Antes de integrar cambios, cree una rama de trabajo, revise el diff y las policies afectadas, y pruebe rutas públicas, `/login`, `/admin`, Storage y contacto. Confirme variables de Netlify y secretos de Actions. Tras desplegar, revise consola, logs de Functions y autorización real.

`index.html`, `robots.txt` y `sitemap.xml` contienen marcadores de dominio oficial. Sustitúyalos por el dominio productivo mediante una tarea de configuración deliberada.

## Checklist de producción

- [ ] RLS y Storage Policies revisadas.
- [ ] Administradores mínimos creados en Auth y registrados por UUID.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en variables server-side.
- [ ] Bucket, imágenes, video convencional y TUS verificados.
- [ ] Function de contacto probada con consentimiento y honeypot.
- [ ] CSP y cabeceras probadas tras cambios de terceros.
- [ ] Dominio canónico, `robots.txt` y `sitemap.xml` actualizados.
- [ ] No hay secretos, `.env` reales ni credenciales en el diff o historial a publicar.
- [ ] Existe un respaldo de esquema, policies y despliegue.

## Seguridad, mantenimiento y troubleshooting

- Las contraseñas, tokens privados, claves privilegiadas y credenciales administrativas nunca deben entrar a Git. Ante una exposición, rótelas o revóquelas, elimínelas del código, audite el historial y trate backups antiguos como confidenciales.
- Una clave pública de Supabase no concede permisos administrativos: RLS y Storage Policies son el límite de autorización.
- Si el panel no puede escribir, revise sesión, registro en `admin_users`, `is_admin()` y policies, sin deshabilitar RLS globalmente.
- Si falla una carga, compruebe tipo MIME, tamaño, sesión, bucket, path y policy. Para TUS, compruebe librería y endpoint.
- Si el portafolio queda vacío, revise la consulta de `projects`, los estados de `main.js`, `images`/`video_assets` y la consola.
- Si falla contacto, revise consentimiento, validación, variables de Netlify y logs de la Function; nunca exponga la Service Role Key para diagnosticar.

El estado actual combina contenido público, panel administrativo protegido por datos y backend serverless mínimo. Mantenga la seguridad en Supabase y Netlify, no solo en la interfaz.
