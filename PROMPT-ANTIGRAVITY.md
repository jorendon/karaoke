# PROMPT PARA ANTIGRAVITY — App de Karaoke (wrapper de YouTube)

> Pega todo este texto como primera instrucción en Antigravity.
> **Repositorio del proyecto: https://github.com/jorendon/karaoke.git**
> Clona ese repositorio y trabaja DENTRO de él: todo el código se escribe,
> se commitea y se pushea ahí. Los archivos base (`supabase/schema.sql`,
> `.env.example`, `README.md` y este prompt) te llegan por correo: cópialos a
> la raíz del repo y haz el PRIMER commit con ellos antes de empezar a
> programar. Crea tu `.env.local` a partir del `.env.example` (el
> `.env.local` NUNCA se commitea).

---

## 0. Repositorio y control de versiones

- Repo: **https://github.com/jorendon/karaoke.git** (GitHub, usuario jorendon).
- Haz commit al final de CADA fase de implementación (sección 13), con
  mensajes claros en español o inglés, y **push a la rama `main`** al terminar
  cada fase. No dejes trabajo sin pushear.
- Agrega un `.gitignore` de Next.js desde el inicio: `node_modules`, `.next`,
  `.env*.local` y cualquier archivo con claves quedan FUERA del repo.
- El despliegue en Vercel se conecta a este mismo repositorio (deploy
  automático con cada push a `main`).

---

Actúa como un desarrollador senior full-stack. Vas a construir, por fases y en
este orden, una aplicación web de karaoke para fiestas en casa. No cambies el
stack, los nombres de tablas ni las rutas definidas aquí. Si algo es ambiguo,
elige la opción más simple y documenta la decisión en el README.

## 1. Qué es la app

Un "wrapper" de YouTube enfocado SOLO en karaoke:

- Un **anfitrión** (usuario registrado) inicia sesión, crea una **sesión**
  (una fiesta) y obtiene un enlace público y un **código QR**.
- Los **invitados** escanean el QR con su celular, SIN crear cuenta, buscan
  canciones en un catálogo de karaoke y las agregan a la **cola** de la sesión
  escribiendo su nombre.
- La pantalla del anfitrión (idealmente una TV o laptop) muestra el
  reproductor de YouTube, la cola en vivo y el QR. Cuando un video termina,
  suena el siguiente de la cola automáticamente.

## 2. Stack obligatorio

- Next.js 14+ con **App Router**, **TypeScript** y **Tailwind CSS**.
- **Supabase** como base de datos Postgres y para **Realtime** (la cola se
  sincroniza en vivo entre la pantalla del anfitrión y los celulares).
- **YouTube IFrame Player API** para reproducir videos embebidos.
- **YouTube Data API v3** SOLO desde el servidor (rutas API de Next.js),
  nunca desde el navegador.
- Librerías: `@supabase/supabase-js`, `bcryptjs` (hash de contraseñas),
  `jose` (JWT para la cookie de sesión), `qrcode` (generar el QR de la sesión).
- Despliegue objetivo: **Vercel**, con dominio propio. La URL pública se lee
  de `NEXT_PUBLIC_APP_URL`.

## 3. Variables de entorno (ya están en .env.local)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (solo servidor), `YOUTUBE_API_KEY` (solo
servidor), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`.

Reglas: crea un cliente Supabase de navegador (anon key) y uno de servidor
(service_role) en `lib/supabase/`. Ninguna clave de servidor puede aparecer en
código que corra en el cliente.

## 3A. Configuración de la cuenta de YouTube (Google) del usuario

La API de YouTube se usa con la cuenta de Google del usuario (la misma de su
canal de YouTube). **Antes de la fase de catálogo (fase 4 de la sección 13),
entrégale al usuario estos pasos tal cual y espera a que confirme que la
clave ya está en su `.env.local`.** No inventes una clave ni uses una tuya.

Pasos que debes entregarle:

1. Entra a https://console.cloud.google.com con tu cuenta de Google (la de
   tu YouTube) e inicia sesión.
2. Arriba, en el selector de proyectos, elige **"Proyecto nuevo"**. Nombre
   sugerido: `karaoke-app`. Botón **Crear**, y espera a que quede
   seleccionado ese proyecto.
3. En el menú lateral: **"APIs y servicios" → "Biblioteca"**. Busca
   **"YouTube Data API v3"**, ábrela y pulsa **"Habilitar"**.
4. Ve a **"APIs y servicios" → "Credenciales" → "Crear credenciales" →
   "Clave de API"**. Copia la clave que se genera.
5. Restringe la clave (recomendado): haz clic sobre la clave recién creada →
   en **"Restricciones de API"** elige **"Restringir clave"** y marca SOLO
   **"YouTube Data API v3"** → **Guardar**. Así esa clave no sirve para
   ningún otro servicio de Google.
6. Pega la clave en el archivo `.env.local` del proyecto:
   `YOUTUBE_API_KEY=<la clave>`. Al desplegar, carga el mismo valor en
   Vercel (Project Settings → Environment Variables).
7. Cuota: la cuenta tiene **10,000 unidades diarias gratis**. Costos de lo
   que usa la app: una búsqueda (`search.list`) = 100 unidades; verificar un
   video (`videos.list`) = 1; listar los videos de un canal
   (`playlistItems.list`) = 1 por página de 50. Por eso el diseño busca
   primero en el catálogo propio y cachea todo: para uso en casa la cuota
   gratuita alcanza de sobra.

Aclaraciones que también debes darle al usuario:

- La app **NO inicia sesión en su cuenta de YouTube ni toca su canal**: la
  clave solo lee datos públicos de videos (título, miniatura, si se puede
  embeber). Los videos se reproducen con el reproductor oficial de YouTube,
  como en cualquier página web.
- No necesita YouTube Premium ni pagar nada por esta API.
- Si Google muestra pantallas de verificación o de aceptación de términos
  durante la creación del proyecto, son pasos normales de Google Cloud.
- Si la clave se filtra algún día, se elimina en "Credenciales" y se crea
  otra en 2 minutos; por eso va solo en `.env.local` y en Vercel, nunca en
  el código ni en el repositorio.

## 4. Base de datos

El esquema YA EXISTE: está en `supabase/schema.sql`. Debe estar ejecutado en
Supabase antes de programar contra él (Supabase Dashboard → SQL Editor); si
no lo está, avisa y espera. Úsalo tal cual, no lo modifiques. Tablas:

- `app_users` — usuarios anfitriones: `username` único, `password_hash`
  (bcrypt), `display_name`, `role` ('admin' | 'host'), `is_active`.
- `songs` — catálogo: `youtube_video_id` único, `title`, `artist`, `genre`,
  `channel_title`, `thumbnail_url`, `duration_seconds`, `is_embeddable`,
  `last_verified_at`.
- `sessions` — `code` único (va en la URL pública), `name`, `owner_id`,
  `is_active`, `closed_at`.
- `queue_items` — `session_id`, `song_id` (nullable), `youtube_video_id`,
  `title`, `artist`, `requested_by`, `position`, `status`
  ('pending' | 'playing' | 'played' | 'skipped').
- `playlists` y `playlist_items` — listas guardadas del anfitrión (fase 5).

Todas las ESCRITURAS en la base se hacen desde rutas API del servidor con el
cliente service_role. El cliente del navegador solo LEE (catálogo, sesión y
cola, con las políticas RLS ya creadas) y se suscribe a Realtime.

## 5. Autenticación (usuarios de la tabla, sin Supabase Auth)

- `POST /api/auth/login` recibe `{ username, password }`. Busca el usuario en
  `app_users` (service_role), exige `is_active = true` y compara la contraseña
  con `bcrypt.compare`. Si pasa, crea un JWT firmado con `AUTH_SECRET`
  (payload: `userId`, `username`, `role`; expira en 7 días) y lo guarda en una
  cookie **httpOnly** llamada `karaoke_session`, `sameSite: 'lax'`,
  `secure` en producción.
- `POST /api/auth/logout` borra la cookie.
- Un `middleware.ts` protege todas las rutas excepto: `/login`, `/s/[code]`
  (vista pública del invitado) y las rutas API públicas de la sesión que se
  indican abajo. Sin cookie válida → redirigir a `/login`.
- Pantalla `/login`: formulario simple usuario/contraseña, mensaje de error
  genérico ("Usuario o contraseña incorrectos"), sin revelar cuál falló.
- Administración de usuarios: página `/admin/users`, visible solo si
  `role = 'admin'`, para crear usuarios (username, contraseña que se hashea
  con bcrypt en el servidor, display_name, role), activar/desactivar y
  eliminar. Además crea un script `scripts/create-user.ts` que hace lo mismo
  desde terminal, para crear el primer usuario admin.
- Las contraseñas NUNCA se guardan ni se registran en logs en texto plano.

## 6. Sesiones y QR

- El anfitrión, ya logueado, ve en `/dashboard`: sus sesiones y un botón
  "Nueva sesión" (pide solo el nombre, ej. "Cumpleaños de mamá"). El `code` se
  genera en el servidor: cadena aleatoria de 8 caracteres en minúsculas
  (sin caracteres ambiguos).
- Cada sesión tiene URL pública: `${NEXT_PUBLIC_APP_URL}/s/[code]`.
- El QR se genera en el servidor con la librería `qrcode` (data URL PNG) en
  `GET /api/sessions/[code]/qr` o como componente server; se muestra en la
  pantalla del anfitrión y debe poder regenerarse si cambia el dominio.
- El anfitrión puede **cerrar** la sesión (`is_active = false`,
  `closed_at = now()`): los invitados ven "Esta sesión terminó" y ya no pueden
  agregar canciones.

## 7. Catálogo y búsqueda

- La búsqueda principal es contra la tabla `songs` (sin gastar cuota de
  YouTube): `GET /api/songs/search?q=&artist=&genre=&limit=30`.
  - `q` busca en título y artista (ILIKE).
  - Filtros independientes por **artista** y por **género** (selects con los
    valores distintos presentes en el catálogo).
  - Géneros de referencia: Baladas, Salsa, Merengue, Bachata, Rock en
    español, Rock, Pop, Pop en español, Regional mexicano, Ranchera,
    Vallenato, Reguetón, Cumbia, 80s, 90s, Infantil, Cristiana, Otro.
- Si el catálogo devuelve menos de 5 resultados y hay `q`, la ruta llama a la
  **YouTube Data API** como respaldo: `search.list` con
  `q = "<q> karaoke"`, `type=video`, `videoEmbeddable=true`,
  `videoSyndicated=true`, `maxResults=10`. Los resultados nuevos se guardan
  en `songs` (upsert por `youtube_video_id`) con `artist`/`genre` nulos o
  inferidos del título solo si es evidente; el anfitrión puede corregirlos
  después (fase 5). Cachea: nunca repitas la misma búsqueda a la API en menos
  de 24 h (tabla simple de caché en memoria del servidor o en `songs` por
  `last_verified_at`; lo más simple que funcione).
- Script de indexación `scripts/index-channel.ts`: recibe el ID de un canal
  de YouTube, recorre su playlist de subidas con `playlistItems.list`
  (1 unidad por página de 50) y hace upsert en `songs`. Canales iniciales a
  indexar: Sing King, KaraokeOnVEVO, Pocket Songs, Zoom Karaoke, Sing2Music
  (el script recibe el canal por argumento; no hardcodees IDs sin verificar).

## 8. Verificación del enlace ANTES de agregar a la cola (requisito clave)

Ninguna canción entra a la cola sin verificación del servidor:

- `POST /api/queue/verify` (o lógica interna de la ruta que agrega) recibe el
  `youtube_video_id` y:
  1. Si está en `songs` con `is_embeddable = true` y `last_verified_at` de
     hace menos de 30 días → válido, sin llamar a YouTube.
  2. Si no, llama a `videos.list?part=status,contentDetails&id=<id>`:
     válido SOLO si la respuesta trae el video, `status.embeddable === true`
     y `status.uploadStatus === 'processed'` (no privado, no borrado).
     Actualiza `songs` con el resultado y `last_verified_at = now()`.
  3. Si no es válido → responde 422 con mensaje claro para el usuario:
     "Este video no se puede reproducir aquí (está bloqueado o ya no existe)".
- La ruta que agrega a la cola SIEMPRE ejecuta esta verificación primero;
  no confíes en verificaciones hechas en el cliente.

## 9. La cola

- `POST /api/sessions/[code]/queue` — pública (invitados), body:
  `{ youtubeVideoId, title, artist, requestedBy }`. Verifica la sesión activa,
  ejecuta la verificación del punto 8, calcula `position = max(position)+1`
  de los items 'pending'/'playing' de la sesión e inserta. `requestedBy` es
  obligatorio (máx. 30 caracteres); si falta, usar "Invitado".
- Controles SOLO del anfitrión dueño de la sesión (cookie válida y
  `owner_id` = usuario):
  - `PATCH /api/queue/[id]` con `{ action: 'up' | 'down' | 'remove' | 'skip' | 'play-now' }`:
    subir/bajar intercambia `position` con el vecino 'pending'; 'remove'
    elimina la fila; 'skip' marca 'skipped'; 'play-now' la pone 'playing'.
  - Al terminar un video, el cliente del anfitrión llama
    `POST /api/sessions/[code]/queue/advance`: marca el 'playing' actual como
    'played' y promueve el siguiente 'pending' (menor position) a 'playing',
    devolviéndolo para cargarlo en el reproductor.
- La cola se actualiza en TODAS las pantallas con Supabase Realtime
  (suscripción a `queue_items` filtrada por `session_id`).

## 10. Pantalla del anfitrión — `/host/[code]`

Layout de escritorio/TV en tres columnas (Tailwind, tema oscuro, texto
grande, pensado para leerse desde lejos):

- **Centro (ancho mayor):** el reproductor de YouTube (IFrame API, 16:9,
  `autoplay` cuando cambia el item 'playing'). Debajo: título y artista de la
  canción actual, quién la pidió, y botones grandes: **Siguiente**,
  **Pausar/Reanudar**, **Pantalla completa**.
- **Un lado — la cola:** lista numerada de items 'pending' en orden, cada uno
  con título, artista, quién lo pidió y botones ↑ ↓ ✕ (solo anfitrión).
  Arriba de la lista, "Ahora suena". Abajo, sección colapsable "Ya sonaron".
  El anfitrión también puede buscar en el catálogo desde aquí y agregar.
- **El otro lado — panel de la sesión:** nombre de la sesión, el **QR grande**
  con el texto "Escanea para pedir tu canción", la URL corta de la sesión y
  el contador de canciones en cola. Botón "Cerrar sesión" al final.
- Comportamiento: al montar, si no hay nada 'playing', promueve el primer
  'pending'. Cuando el reproductor reporta estado `ENDED`, llama a
  `queue/advance` y carga el siguiente. Si el reproductor reporta un error
  (video no embebible pese a la verificación), marca el item 'skipped' y
  avanza automáticamente.
- En móvil, las columnas se apilan: reproductor, cola, QR.

## 11. Vista del invitado — `/s/[code]` (pública, móvil primero)

- Encabezado con el nombre de la sesión.
- Campo para su **nombre** (se guarda en localStorage) — sin nombre no puede
  agregar.
- Buscador del catálogo con filtros por **artista** y **género** (reusa
  `/api/songs/search`). Cada resultado: miniatura, título, artista y botón
  **"Agregar a la cola"**. Tras agregar, confirmación visible ("¡Agregada!
  Eres el #N en la fila").
- La cola actual en modo lectura: "Ahora suena" y la lista en orden, con su
  nombre resaltado en sus canciones. Se actualiza por Realtime.
- Si la sesión está cerrada: mensaje "Esta sesión terminó 🎤" y sin buscador.

## 12. Páginas y rutas (resumen)

- `/` → redirige a `/dashboard` si hay sesión de usuario; si no, a `/login`.
- `/login`, `/dashboard`, `/admin/users`, `/host/[code]`, `/s/[code]`.
- API: `/api/auth/login`, `/api/auth/logout`, `/api/admin/users`,
  `/api/sessions` (crear/listar), `/api/sessions/[code]/close`,
  `/api/sessions/[code]/qr`, `/api/songs/search`,
  `/api/sessions/[code]/queue` (agregar), `/api/sessions/[code]/queue/advance`,
  `/api/queue/[id]` (controles del anfitrión).

## 13. Fases de implementación (en este orden, confirmando al final de cada una)

1. **Base:** proyecto Next.js + Tailwind, clientes Supabase, `.env` validado,
   layout con tema oscuro.
2. **Auth:** login/logout, middleware, script `create-user`, página
   `/admin/users`.
3. **Sesiones:** crear/listar/cerrar, código, QR, dashboard.
4. **Catálogo:** primero entrega al usuario los pasos de la sección 3A y
   confirma que `YOUTUBE_API_KEY` está en `.env.local`; luego: búsqueda
   contra `songs` + respaldo YouTube API con caché + script de indexación
   de canales.
5. **Cola y verificación:** verificación con `videos.list`, agregar,
   controles del anfitrión, `advance`, Realtime. **Playlists guardadas:**
   crear listas desde el dashboard y cargar una lista completa a la cola de
   una sesión.
6. **Pantallas:** `/host/[code]` completa con IFrame API y auto-avance, y
   `/s/[code]` del invitado.
7. **Pulido y despliegue:** README con pasos para Vercel y dominio,
   manejo de errores, estados vacíos.

## 14. Criterios de aceptación

- Un usuario que NO está en `app_users` no puede entrar; uno desactivado,
  tampoco. Las contraseñas nunca aparecen en texto plano en la base.
- Un invitado sin cuenta puede abrir `/s/[code]`, buscar por artista y por
  género, y agregar una canción; aparece en la pantalla del anfitrión en
  menos de 2 segundos (Realtime).
- Un video privado, borrado o con inserción deshabilitada NUNCA entra a la
  cola: la verificación del servidor lo rechaza con mensaje claro.
- El anfitrión puede subir, bajar y eliminar cualquier canción de la cola, y
  el orden se refleja en todos los celulares conectados.
- Al terminar una canción suena la siguiente sin tocar nada; si una falla en
  el reproductor, se salta sola.
- El QR de la pantalla del anfitrión abre la vista del invitado en un celular
  usando el dominio de `NEXT_PUBLIC_APP_URL`.
- `YOUTUBE_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` no aparecen en el bundle
  del navegador (verificable buscando en el build).

## 15. Lo que NO debes hacer

- No descargar videos ni audio de YouTube, ni separar el audio del video:
  todo se reproduce con el reproductor oficial embebido, con su branding.
- No usar Supabase Auth: la autenticación es la de la tabla `app_users`
  descrita arriba.
- No exponer la service_role key ni la API key de YouTube en el cliente.
- No permitir que un invitado modifique o borre canciones de otros, ni que un
  anfitrión controle sesiones que no son suyas.
- No gastar cuota de YouTube sin caché: la búsqueda normal es contra `songs`.

---

*Fin del prompt. Archivos de apoyo en el mismo proyecto: `supabase/schema.sql`
(esquema ya ejecutado) y `.env.example` (referencia de variables).*
