# Portafolio Javiera Gurruchaga

Portafolio público y panel administrativo. Netlify sirve los archivos estáticos y recibe los mensajes mediante Netlify Forms. Supabase aporta autenticación, base de datos con RLS y almacenamiento multimedia.

## Preparación y build

```bash
npm ci
npm run build
```

El build copia únicamente los archivos públicos a `dist/`, compila el CSS del panel y empaqueta versiones fijadas de Supabase JS y TUS. Netlify ejecuta `npm run build` y publica `dist/`. `README.md`, `sql/`, `scripts/`, `node_modules/` y `.git/` quedan fuera del sitio.

Las dependencias están fijadas en `package-lock.json`. Revise `npm audit` al actualizarlas. El JavaScript y CSS de producción se sirven desde el mismo origen; `_headers` no admite scripts inline ni CDN de JavaScript.

## Supabase

`js/config.js` contiene la URL y clave publicable del proyecto. Esa clave puede estar en el navegador; **nunca** coloque allí una clave `service_role`. El acceso a datos lo controlan Auth, RLS y las políticas de Storage.

Antes de publicar la nueva versión, ejecute `sql/schema.sql` en el SQL Editor del proyecto correcto. El script:

- crea `private.is_admin()` y retira los permisos de ejecución de la antigua función pública;
- permite la lectura anónima únicamente de proyectos `published = true`;
- conserva como publicados los proyectos existentes cuando añade la columna por primera vez;
- crea los proyectos nuevos como borradores hasta que se marque **Publicar este proyecto** en el panel;
- limita escrituras de proyectos, ajustes y archivos a UUID registrados en `public.admin_users`;
- revoca acceso de navegador a la antigua tabla `contact_messages`, sin borrar los mensajes históricos.

Después de crear una cuenta en Supabase Authentication, registre su UUID de administrador con la instrucción comentada al final de `sql/schema.sql`. No abra permisos de escritura a `anon`.

El bucket `portafolio-media` sigue siendo público para servir archivos publicados. El script SQL configura sus políticas de escritura y crea buckets nuevos con límites. Para aplicar esos límites a un bucket existente, use la API de Storage:

```bash
npm run configure:storage
```

Para ejecutar ese comando, defina temporalmente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno de la terminal. `scripts/configure-storage.mjs` verifica que la URL corresponda al proyecto esperado y fija un límite de 50 MiB y una lista de tipos MIME para imágenes, video y audio. No guarde esa clave en Git ni la pase al navegador. Los archivos existentes no se eliminan.

## Contacto y privacidad

El formulario `contact` de `index.html` envía una sola solicitud codificada a Netlify Forms. Incluye un campo honeypot y exige consentimiento en el navegador. Configure y compruebe la notificación del destinatario en Netlify Forms → Submission notifications. La función antigua de contacto ya no se despliega ni usa la clave privilegiada.

`privacidad.html` indica que Netlify Forms almacena las consultas. Los mensajes históricos en `public.contact_messages` permanecen en Supabase hasta que su responsable decida su conservación o eliminación. Al retirar la función, retire también `SUPABASE_SERVICE_ROLE_KEY` de las variables de Netlify si no se usa para otro fin.

La preferencia del aviso de cookies se almacena en `localStorage`. No se ha implementado analítica ni marketing. Supabase Auth persiste la sesión administrativa en el navegador; por eso la CSP y el control de dependencias son importantes.

## Panel y archivos

`login.html` inicia sesión con Supabase Auth. `requireAuth()` redirige a visitantes sin sesión, pero la autorización real ocurre en RLS. El panel permite crear borradores, publicarlos, editar proyectos y administrar ajustes de contacto.

`js/supabaseClient.js` valida tipo y tamaño antes de subir. Los videos de más de 6 MiB usan TUS; todos los tipos admitidos tienen un máximo de 50 MiB. Los límites efectivos deben estar también en el bucket, porque la validación del navegador se puede omitir.

## Comprobaciones

```bash
npm audit
node --check js/main.js
node --check js/admin.js
node --check js/supabaseClient.js
npm test
git diff --check
```

Después de aplicar el SQL y desplegar, compruebe el portafolio público, borradores, login, CRUD, uploads, preferencias de cookies y una entrega real del formulario. Revise las cabeceras CSP, las notificaciones de Netlify Forms y las políticas efectivas de Supabase. No publique el cambio del frontend antes de añadir `published` en la base de datos, porque la consulta pública nueva depende de esa columna.
