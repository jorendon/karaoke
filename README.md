# Karaoke en Casa

Aplicación web de karaoke para fiestas en casa construida como un "wrapper" oficial de YouTube:

- Un **anfitrión** registrado inicia sesión, crea una **sesión** (fiesta) y muestra un **código QR** en su TV o laptop (`/host/[code]`).
- Los **invitados** escanean el QR con su celular (`/s/[code]`), **sin crear cuenta**, escriben su nombre, buscan canciones en el catálogo y las agregan a la cola en tiempo real.
- La pantalla del anfitrión reproduce los videos con el **reproductor oficial de YouTube (IFrame Player API)**, sincroniza la cola por **Supabase Realtime** y avanza automáticamente al terminar o si un video falla.

## Stack

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS v4**
- **Supabase** (Postgres + Realtime + RLS)
- **YouTube IFrame Player API** (reproducción embebida oficial)
- **YouTube Data API v3** exclusivamente desde el servidor (búsqueda de respaldo con caché 24 h, verificación previa con `videos.list` e indexación de canales con `playlistItems.list`)
- **Autenticación propia** sobre `public.app_users` (`bcryptjs` + JWT HS256 con `jose` en cookie `httpOnly` `karaoke_session`)
- **Despliegue:** Vercel

## Rutas principales

### Páginas
- `/` — Redirige a `/dashboard` si hay sesión activa, o a `/login` si no.
- `/login` — Inicio de sesión para anfitriones.
- `/dashboard` — Sesiones activas/finalizadas, generador de QR y **Playlists guardadas** (crear listas y cargarlas a cualquier sesión activa).
- `/catalog` — Explorador del catálogo, editor de artista/género e indexador web de canales de YouTube.
- `/admin/users` — Gestión de usuarios (solo `role = 'admin'`).
- `/host/[code]` — Pantalla TV/escritorio del anfitrión (3 columnas: cola con controles `↑ ↓ ▶ ✕`, reproductor YouTube 16:9 con auto-avance y controles grandes, panel del QR y cierre de sesión).
- `/s/[code]` — Vista pública móvil para invitados (nombre en `localStorage`, buscador con filtros por artista/género y cola en vivo).

### APIs
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST /api/admin/users`, `PATCH/DELETE /api/admin/users/[id]`
- `GET/POST /api/sessions`, `POST /api/sessions/[code]/close`, `GET /api/sessions/[code]/qr`
- `GET /api/songs/search`, `PATCH /api/songs/[id]`, `POST /api/songs/index-channel`
- `POST /api/queue/verify`
- `GET/POST /api/sessions/[code]/queue`, `POST /api/sessions/[code]/queue/advance`, `PATCH /api/queue/[id]`
- `GET/POST /api/playlists`, `DELETE /api/playlists/[id]`, `POST/DELETE /api/playlists/[id]/items`, `POST /api/playlists/[id]/load`
- `GET /api/health`

## Variables de entorno

Copia `.env.example` a `.env.local` (nunca se commitea) o cárgalas en **Vercel → Settings → Environment Variables**:

| Variable | Alcance | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Clave `anon` pública (solo lectura y Realtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | Clave `service_role` (todas las escrituras y `app_users`) |
| `YOUTUBE_API_KEY` | Solo servidor | Clave de Google Cloud restringida a YouTube Data API v3 |
| `AUTH_SECRET` | Solo servidor | Secreto aleatorio (32+ chars) para firmar JWT |
| `NEXT_PUBLIC_APP_URL` | Pública | URL pública de la app usada en enlaces y QR (ej. `https://karaoke.jrendon.dev`) |

## Configuración paso a paso

### 1. Base de datos (Supabase)
1. Crea un proyecto en [supabase.com](https://supabase.com) (o con la integración nativa de Vercel).
2. Abre **SQL Editor → New query**, pega el contenido completo de `supabase/schema.sql` y pulsa **Run**.

### 2. Crear el primer usuario administrador
**Opción A (desde terminal local):**
```bash
npm install
npm run create-user
```
*(También soporta `--sql-only` para generar el `INSERT` con hash bcrypt sin conectarse desde tu PC).*

**Opción B (directo en Supabase SQL Editor, sin usar terminal):**
```sql
create extension if not exists pgcrypto;

insert into public.app_users (username, password_hash, display_name, role, is_active)
values (
  'admin',
  crypt('TU_CONTRASENA_SEGURA', gen_salt('bf', 12)),
  'Admin',
  'admin',
  true
);
```

### 3. Configurar YouTube Data API v3
1. En [Google Cloud Console](https://console.cloud.google.com) crea un proyecto (ej. `karaoke-app`).
2. **APIs y servicios → Biblioteca** → busca y habilita **YouTube Data API v3**.
3. **Credenciales → Crear credenciales → Clave de API** (tipo *Datos públicos*).
4. Restringe la clave en **Restricciones de API** únicamente a **YouTube Data API v3** (deja *Restricciones de aplicaciones* en **Ninguno** porque las llamadas salen desde el servidor).
5. Guarda la clave en `YOUTUBE_API_KEY`.

### 4. Poblar el catálogo de karaoke
Puedes indexar canales de karaoke (por ejemplo Sing King, KaraokeOnVEVO, Pocket Songs, Zoom Karaoke, Sing2Music) de dos formas (costo: **1 unidad de cuota por cada 50 canciones**):
- **Desde la web:** entra a `/catalog`, escribe el `@handle` o ID `UC...` del canal y pulsa **Indexar**.
- **Desde terminal:**
  ```bash
  npm run index-channel -- @SingKing --pages 4
  ```

### 5. Despliegue en Vercel y dominio propio
1. En [vercel.com](https://vercel.com), pulsa **Add New → Project** e importa `jorendon/karaoke`.
2. Carga las 6 variables de entorno en **Settings → Environment Variables** para `Production`, `Preview` y `Development`.
3. Conecta tu dominio propio (ej. `karaoke.jrendon.dev`) en **Settings → Domains → Add Domain** y crea el registro `CNAME` que indique Vercel en tu proveedor DNS.
4. Actualiza `NEXT_PUBLIC_APP_URL` a `https://karaoke.jrendon.dev` y haz un **Redeploy**.
5. Si ya tenías sesiones abiertas antes del cambio de dominio, pulsa **Regenerar QR** para emitir el código actualizado con el dominio nuevo.
6. Verifica el estado en `/api/health` (`"ok": true` y todas las variables en `true`).

## Decisiones de diseño documentadas

- **Verificación estricta antes de encolar:** tanto `POST /api/sessions/[code]/queue` como `POST /api/playlists/[id]/load` verifican cada video en el servidor (`songs` caché de 30 días o `videos.list` comprobando `embeddable === true`, `uploadStatus === 'processed'` y que no sea privado).
- **Seguridad de sesiones de usuario:** cada ruta/página protegida valida la firma JWT **y** consulta `app_users.is_active` en servidor, de modo que un usuario desactivado o eliminado pierde acceso de inmediato.
- **Compatibilidad de usuarios manuales:** el login acepta coincidencia exacta o en minúsculas del `username` para evitar bloqueos si un usuario se inserta manualmente con mayúsculas en SQL.
- **Protección de claves:** `lib/env.server.ts` y `lib/supabase/server.ts` usan el paquete `server-only`, impidiendo en tiempo de compilación que `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY` o `AUTH_SECRET` lleguen al bundle del navegador.
- **Caché de cuota YouTube:** las búsquedas siempre consultan primero la tabla `songs`; el respaldo `search.list` solo corre si hay `< 5` resultados locales y queda cacheado 24 h en servidor.
