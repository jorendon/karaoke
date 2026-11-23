import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getYoutubeApiKey } from "@/lib/env.server";
import {
  decodeHtmlEntities,
  inferArtistFromTitle,
  parseIsoDurationToSeconds,
} from "@/lib/youtube/api";
import type { Song } from "@/lib/database.types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const VERIFICATION_CACHE_DAYS = 30;
const VERIFICATION_CACHE_MS = VERIFICATION_CACHE_DAYS * 24 * 60 * 60 * 1000;
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export const UNPLAYABLE_VIDEO_MESSAGE =
  "Este video no se puede reproducir aquí (está bloqueado o ya no existe)";

export interface VideoVerificationResult {
  valid: boolean;
  cached: boolean;
  song: Song | null;
  reason?: string;
}

interface YoutubeVideosListResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        default?: { url?: string };
      };
    };
    contentDetails?: {
      duration?: string;
    };
    status?: {
      embeddable?: boolean;
      uploadStatus?: string;
      privacyStatus?: string;
    };
  }>;
  error?: { message?: string };
}

/**
 * Verifica en el servidor si un video de YouTube existe y puede embeberse.
 * 1. Si está en `songs` con `is_embeddable = true` y `last_verified_at` < 30 días,
 *    responde válido sin llamar a YouTube Data API.
 * 2. De lo contrario consulta `videos.list?part=status,contentDetails,snippet` (1 unidad)
 *    y exige `status.embeddable === true`, `status.uploadStatus === 'processed'`
 *    y que no sea privado. Actualiza `songs` con el resultado y `last_verified_at = now()`.
 */
export async function verifyYoutubeVideoForQueue(
  youtubeVideoId: string,
  fallbackMeta?: { title?: string; artist?: string | null }
): Promise<VideoVerificationResult> {
  const cleanId = youtubeVideoId.trim();
  if (!VIDEO_ID_REGEX.test(cleanId)) {
    return {
      valid: false,
      cached: false,
      song: null,
      reason: UNPLAYABLE_VIDEO_MESSAGE,
    };
  }

  const supabase = getSupabaseServerClient();

  const { data: existingData } = await supabase
    .from("songs")
    .select(
      "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
    )
    .eq("youtube_video_id", cleanId)
    .maybeSingle();

  const existing = existingData as Song | null;

  if (existing && existing.is_embeddable && existing.last_verified_at) {
    const verifiedAge =
      Date.now() - new Date(existing.last_verified_at).getTime();
    if (verifiedAge >= 0 && verifiedAge < VERIFICATION_CACHE_MS) {
      return {
        valid: true,
        cached: true,
        song: existing,
      };
    }
  }

  let apiKey: string;
  try {
    apiKey = getYoutubeApiKey();
  } catch {
    return {
      valid: false,
      cached: false,
      song: existing,
      reason:
        "No se pudo verificar el video porque YOUTUBE_API_KEY no está configurada en el servidor.",
    };
  }

  const params = new URLSearchParams({
    part: "status,contentDetails,snippet",
    id: cleanId,
    key: apiKey,
  });

  const response = await fetch(
    `${YOUTUBE_API_BASE}/videos?${params.toString()}`,
    { cache: "no-store" }
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as YoutubeVideosListResponse;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `YouTube videos.list falló con estado ${response.status}`
    );
  }

  const nowIso = new Date().toISOString();
  const item = payload.items?.[0];

  const isPlayable = Boolean(
    item &&
      item.status?.embeddable === true &&
      item.status?.uploadStatus === "processed" &&
      item.status?.privacyStatus !== "private"
  );

  if (!isPlayable) {
    // Si existía en catálogo, marcarlo como no embebible para no volver a ofrecerlo
    if (existing) {
      await supabase
        .from("songs")
        .update({
          is_embeddable: false,
          last_verified_at: nowIso,
        })
        .eq("id", existing.id);
    }

    return {
      valid: false,
      cached: false,
      song: null,
      reason: UNPLAYABLE_VIDEO_MESSAGE,
    };
  }

  const durationSeconds = parseIsoDurationToSeconds(
    item?.contentDetails?.duration
  );

  if (existing) {
    const { data: updated } = await supabase
      .from("songs")
      .update({
        is_embeddable: true,
        duration_seconds: durationSeconds ?? existing.duration_seconds,
        last_verified_at: nowIso,
      })
      .eq("id", existing.id)
      .select(
        "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
      )
      .single();

    return {
      valid: true,
      cached: false,
      song: (updated as Song | null) ?? existing,
    };
  }

  const rawTitle =
    item?.snippet?.title || fallbackMeta?.title || `Video ${cleanId}`;
  const inferred = inferArtistFromTitle(rawTitle);
  const thumbnailUrl =
    item?.snippet?.thumbnails?.medium?.url ||
    item?.snippet?.thumbnails?.high?.url ||
    item?.snippet?.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${cleanId}/mqdefault.jpg`;

  const { data: inserted } = await supabase
    .from("songs")
    .upsert(
      {
        youtube_video_id: cleanId,
        title: fallbackMeta?.title?.trim() || inferred.title,
        artist: fallbackMeta?.artist?.trim() || inferred.artist,
        channel_title: item?.snippet?.channelTitle
          ? decodeHtmlEntities(item.snippet.channelTitle)
          : null,
        thumbnail_url: thumbnailUrl,
        duration_seconds: durationSeconds,
        is_embeddable: true,
        last_verified_at: nowIso,
      },
      { onConflict: "youtube_video_id" }
    )
    .select(
      "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
    )
    .single();

  return {
    valid: true,
    cached: false,
    song: (inserted as Song | null) ?? null,
  };
}
