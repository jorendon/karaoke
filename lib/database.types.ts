/**
 * Tipos de base de datos correspondientes a supabase/schema.sql.
 * Mantener sincronizado exactamente con el esquema SQL provisto.
 */

export type UserRole = "admin" | "host";

export type QueueItemStatus = "pending" | "playing" | "played" | "skipped";

export interface AppUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type PublicAppUser = Omit<AppUser, "password_hash">;

export interface Song {
  id: string;
  youtube_video_id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_embeddable: boolean;
  last_verified_at: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  code: string;
  name: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  closed_at: string | null;
}

export interface QueueItem {
  id: string;
  session_id: string;
  song_id: string | null;
  youtube_video_id: string;
  title: string;
  artist: string | null;
  requested_by: string | null;
  position: number;
  status: QueueItemStatus;
  created_at: string;
}

export interface Playlist {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  song_id: string | null;
  youtube_video_id: string;
  title: string;
  artist: string | null;
  position: number;
  created_at: string;
}

export const SUGGESTED_GENRES = [
  "Baladas",
  "Salsa",
  "Merengue",
  "Bachata",
  "Rock en español",
  "Rock",
  "Pop",
  "Pop en español",
  "Regional mexicano",
  "Ranchera",
  "Vallenato",
  "Reguetón",
  "Cumbia",
  "80s",
  "90s",
  "Infantil",
  "Cristiana",
  "Otro",
] as const;

export type SuggestedGenre = (typeof SUGGESTED_GENRES)[number];
