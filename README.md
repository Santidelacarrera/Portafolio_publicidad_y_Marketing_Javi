# Portafolio Javiera Gurruchaga

Portafolio estático editorial desplegable en Netlify. Usa JavaScript sin framework, Supabase para contenido, Auth y Storage, y una función de Netlify para el formulario de contacto.

## Arquitectura

- `index.html`, `css/styles.css`, `js/main.js`: sitio público, accesible y sin analítica.
- `admin.html`, `login.html`, `js/admin.js`: CMS privado con Supabase Auth.
- `sql/schema.sql`: esquema, RLS y roles de administradores.
- `netlify/functions/contact.js`: validación de contacto en servidor y escritura con una credencial privada.
- `_headers`: cabeceras de seguridad de Netlify.
- `.github/workflows/supabase-keepalive.yml`: comprobación de disponibilidad, no garantía contra suspensión.

## Configuración obligatoria

1. Ejecute `sql/schema.sql` en Supabase. Si el proyecto ya existía, revise las políticas antiguas indicadas por el script y confirme que fueron eliminadas.
2. Cree usuarios desde Supabase Auth, obtenga sus UUID y agréguelo(s) a `public.admin_users` con la sentencia comentada al final del SQL. No hay usuarios ni contraseñas en el repositorio.
3. Configure en `js/config.js` únicamente la URL y la clave pública/anon de Supabase. La clave pública puede estar en navegador bajo RLS; jamás coloque una `service_role` ahí.
4. En Netlify configure `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables secretas del servidor. No las exponga como variables de build públicas.
5. En GitHub, configure los secretos `SUPABASE_URL` y `SUPABASE_ANON_KEY` para el health check.
6. Sustituya `[DOMINIO-OFICIAL]` en canonical, sitemap y robots; complete los placeholders legales y haga revisar esos textos por asesoría jurídica.

## Desarrollo y verificación

No necesita instalación ni build del frontend. Puede servir la carpeta con `npx serve .`. Para probar funciones localmente use Netlify CLI con las variables anteriores. Compruebe sintaxis con:

```powershell
node --check js/main.js
node --check js/admin.js
node --check netlify/functions/contact.js
```

## Supabase y privacidad

El visitante puede leer proyectos y configuración pública. Sólo usuarios registrados en `admin_users` pueden modificar proyectos, ajustes y Storage. `contact_messages` no tiene políticas de navegador: la función de Netlify valida longitud, formato, honeypot y consentimiento antes de insertar con una clave privada.

El aviso de cookies sólo conserva la preferencia en `localStorage`; no hay analítica ni marketing. El workflow cada tres días es un monitor ligero de la API; no debe presentarse como mecanismo que garantice evitar la pausa del plan de Supabase.

## Pendientes operativos

- Rote inmediatamente las credenciales de administradores que estuvieron presentes en el historial del repositorio y revise el historial remoto.
- Verifique en Supabase que RLS está activado y que no quedan políticas amplias para `authenticated`.
- Configure limitación de tasa perimetral (Netlify/WAF o proveedor equivalente) para el endpoint de contacto; una función serverless no ofrece límite distribuido persistente por sí sola.
- Confirme el dominio, datos de contacto, derechos y créditos reales antes de publicar.
