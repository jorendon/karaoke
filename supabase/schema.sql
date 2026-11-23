-- ============================================================
-- Karaoke App — Esquema de base de datos (Supabase / Postgres)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- Usuarios de la app (anfitriones) ----------
-- Solo quien esté en esta tabla puede iniciar sesión, crear
-- sesiones y controlar el reproductor. Las contraseñas se
-- guardan SIEMPRE con hash bcrypt, nunca en texto plano.
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  display_name  text,
  role          text not null default 'host' check (role in ('admin', 'host')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- Catálogo de canciones karaoke ----------
-- Una fila por video de YouTube. El género lo define el
-- catálogo propio (YouTube no lo provee). is_embeddable y
-- last_verified_at registran la verificación de enlace.
create table if not exists public.songs (
  id               uuid primary key default gen_random_uuid(),
  youtube_video_id text unique not null,
  title            text not null,
  artist           text,
  genre            text,
  channel_title    text,
  thumbnail_url    text,
  duration_seconds integer,
  is_embeddable    boolean not null default true,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists songs_artist_idx on public.songs (artist);
create index if not exists songs_genre_idx  on public.songs (genre);
create index if not exists songs_title_idx  on public.songs (lower(title));

-- ---------- Sesiones (una por fiesta / anfitrión) ----------
-- El "code" es el identificador público que va en el enlace
-- y el QR que escanean los invitados, ej.: /s/navidad2026
create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  owner_id   uuid not null references public.app_users (id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

-- ---------- Cola de reproducción de una sesión ----------
-- Cada fila es una canción pedida. "position" define el orden
-- (el anfitrión puede subir/bajar). "status" marca el avance.
create table if not exists public.queue_items (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions (id) on delete cascade,
  song_id          uuid references public.songs (id) on delete set null,
  youtube_video_id text not null,
  title            text not null,
  artist           text,
  requested_by     text,
  position         integer not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'playing', 'played', 'skipped')),
  created_at       timestamptz not null default now()
);

create index if not exists queue_session_pos_idx
  on public.queue_items (session_id, position);

-- ---------- Listas de reproducción guardadas (opcional, fase 2) ----------
create table if not exists public.playlists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.app_users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_items (
  id               uuid primary key default gen_random_uuid(),
  playlist_id      uuid not null references public.playlists (id) on delete cascade,
  song_id          uuid references public.songs (id) on delete set null,
  youtube_video_id text not null,
  title            text not null,
  artist           text,
  position         integer not null,
  created_at       timestamptz not null default now()
);

-- ---------- Realtime ----------
-- La cola y las sesiones se sincronizan en vivo entre la
-- pantalla del anfitrión y los celulares de los invitados.
alter publication supabase_realtime add table public.queue_items;
alter publication supabase_realtime add table public.sessions;

-- ---------- Seguridad (RLS) ----------
-- Decisión MVP (fiesta casera): lectura pública de catálogo,
-- sesiones y colas; TODAS las escrituras pasan por las rutas
-- API del servidor con la service_role key (que ignora RLS).
-- app_users NO tiene políticas públicas: solo el servidor la lee.
alter table public.app_users      enable row level security;
alter table public.songs          enable row level security;
alter table public.sessions       enable row level security;
alter table public.queue_items    enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_items enable row level security;

create policy "songs public read"    on public.songs
  for select using (true);
create policy "sessions public read" on public.sessions
  for select using (true);
create policy "queue public read"    on public.queue_items
  for select using (true);

-- ---------- Géneros sugeridos (referencia para el catálogo) ----------
-- Baladas, Salsa, Merengue, Bachata, Rock en español, Rock,
-- Pop, Pop en español, Regional mexicano, Ranchera, Vallenato,
-- Reguetón, Cumbia, 80s, 90s, Infantil, Cristiana, Otro
