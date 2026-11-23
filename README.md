# Karaoke App — Bases del proyecto

**Repositorio: https://github.com/jorendon/karaoke.git** — todo el código vive
ahí; Antigravity clona este repo, escribe dentro de él y pushea a `main`
al final de cada fase. Vercel despliega desde este mismo repo.

App web tipo "wrapper de YouTube" enfocada solo en karaoke, para fiestas en casa:
búsqueda por artista y género sobre un catálogo propio, reproductor embebido,
sesiones protegidas por usuario/contraseña, y un QR por sesión para que los
invitados agreguen canciones a la cola desde su celular.

## Qué contiene esta carpeta

| Archivo | Para qué |
|---|---|
| `PROMPT-ANTIGRAVITY.md` | El prompt completo y específico para pegar en Antigravity. Es el documento principal. |
| `supabase/schema.sql` | Esquema de la base de datos (usuarios, catálogo, sesiones, cola, playlists) + Realtime + RLS. |
| `.env.example` | Variables de entorno necesarias (Supabase, YouTube API, secreto de sesión, URL pública). |

## Stack decidido

- **Next.js (App Router) + TypeScript + Tailwind CSS** — desplegado en **Vercel** (dominio propio).
- **Supabase** (Postgres + Realtime) — catálogo, usuarios, sesiones y cola sincronizada en vivo.
- **YouTube IFrame Player API** para reproducir y **YouTube Data API v3** para buscar,
  indexar canales de karaoke y **verificar que cada video exista y sea embebible**
  antes de entrar a la cola.

## Pasos previos (antes o en paralelo a Antigravity)

1. **Supabase:** crea un proyecto gratis en supabase.com → SQL Editor → pega y ejecuta
   `supabase/schema.sql` → copia la URL y las claves (anon y service_role).
2. **YouTube API key:** en Google Cloud Console crea un proyecto → activa
   "YouTube Data API v3" → Credenciales → Crear clave de API.
3. **Vercel:** crea el proyecto desde el repo y carga las variables de `.env.example`
   en Settings → Environment Variables. Al final, conecta tu dominio.
4. **Primer usuario:** la contraseña se guarda con hash bcrypt. El prompt de
   Antigravity incluye una ruta/pantalla de administración para crear usuarios
   (o un script `scripts/create-user.ts`); nunca insertes contraseñas en texto plano.

## Cómo se usa con Antigravity

1. Crea el proyecto vacío en Antigravity (o clona el repo) y copia dentro
   `supabase/schema.sql` y `.env.example` → renombra a `.env.local` con tus valores.
2. Pega el contenido completo de `PROMPT-ANTIGRAVITY.md` como primera instrucción.
3. Antigravity construye por fases (el prompt las trae ordenadas). Revisa al final
   de cada fase con los criterios de aceptación que el mismo prompt incluye.

## Decisiones de diseño ya tomadas (están en el prompt)

- **Usuarios en tabla propia** (`app_users`, usuario + contraseña con hash bcrypt,
  sesión por cookie httpOnly firmada). Solo usuarios de la tabla pueden entrar,
  crear sesiones y controlar el reproductor.
- **Sesión = una fiesta.** El anfitrión crea una sesión y la app genera un enlace
  público `/s/[codigo]` y su **QR**. Los invitados NO necesitan cuenta: abren el
  enlace, buscan en el catálogo y agregan canciones con su nombre.
- **Pantalla del anfitrión:** reproductor grande, la **cola a un lado** (con controles
  para subir, bajar y eliminar cualquier canción) y el **panel del QR al otro lado**.
- **Verificación antes de agregar:** ninguna canción entra a la cola sin pasar por el
  servidor, que confirma con la API de YouTube que el video existe y es embebible;
  el resultado se cachea en el catálogo para no gastar cuota dos veces.
- **Cuota de la API:** la búsqueda principal es contra el catálogo propio (sin costo);
  la API de YouTube es respaldo e indexación, siempre con caché.
