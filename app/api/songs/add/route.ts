import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  UNPLAYABLE_VIDEO_MESSAGE,
  verifyYoutubeVideoForQueue,
} from "@/lib/youtube/verify";
import type { Song } from "@/lib/database.types";

const RAW_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (RAW_VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return RAW_VIDEO_ID_REGEX.test(candidate) ? candidate : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v && RAW_VIDEO_ID_REGEX.test(v)) return v;

      const segments = parsed.pathname.split("/").filter(Boolean);
      if (
        (segments[0] === "embed" ||
          segments[0] === "shorts" ||
          segments[0] === "live") &&
        segments[1] &&
        RAW_VIDEO_ID_REGEX.test(segments[1])
      ) {
        return segments[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Agrega un video individual de YouTube (por URL o ID) al catálogo `songs`.
 * 1. Verifica primero en `songs` si ya existe (0 unidades de cuota).
 *    Si ya existe, responde 409 avisando sin duplicar.
 * 2. Si es nuevo, verifica con `videos.list` (1 unidad) que exista y sea embebible
 *    y lo guarda en `songs` con artista/género opcionales.
 */
export async function POST(request: Request) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  let body: {
    urlOrId?: unknown;
    artist?: unknown;
    genre?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const rawInput = typeof body.urlOrId === "string" ? body.urlOrId : "";
  const videoId = extractYoutubeVideoId(rawInput);

  if (!videoId) {
    return NextResponse.json(
      {
        error:
          "Enlace o ID de YouTube inválido. Pega una URL de youtube.com/watch?v=..., youtu.be/... o el ID de 11 caracteres.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // 1. Verificar duplicado en base de datos antes de llamar a YouTube
  const { data: existingData, error: existingError } = await supabase
    .from("songs")
    .select(
      "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
    )
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: "No se pudo verificar si el video ya existe." },
      { status: 500 }
    );
  }

  if (existingData) {
    const existing = existingData as Song;
    return NextResponse.json(
      {
        duplicate: true,
        song: existing,
        error: `Este video ya existe en tu catálogo: "${existing.title}" (${videoId}).`,
      },
      { status: 409 }
    );
  }

  // 2. Verificar con videos.list y guardar en catálogo
  const customArtist =
    typeof body.artist === "string" && body.artist.trim()
      ? body.artist.trim().slice(0, 100)
      : null;
  const customGenre =
    typeof body.genre === "string" && body.genre.trim()
      ? body.genre.trim().slice(0, 60)
      : null;

  let verification;
  try {
    verification = await verifyYoutubeVideoForQueue(videoId, {
      artist: customArtist,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al verificar el video en YouTube.",
      },
      { status: 502 }
    );
  }

  if (!verification.valid || !verification.song) {
    return NextResponse.json(
      { error: verification.reason || UNPLAYABLE_VIDEO_MESSAGE },
      { status: 422 }
    );
  }

  let savedSong = verification.song;

  // Aplicar artista o género elegidos manualmente si se enviaron
  if (customArtist || customGenre) {
    const updates: Record<string, string | null> = {};
    if (customArtist) updates.artist = customArtist;
    if (customGenre) updates.genre = customGenre;

    const { data: updated } = await supabase
      .from("songs")
      .update(updates)
      .eq("id", savedSong.id)
      .select(
        "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
      )
      .single();

    if (updated) {
      savedSong = updated as Song;
    }
  }

  const { count } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("is_embeddable", true);

  return NextResponse.json(
    {
      song: savedSong,
      totalCatalogCount: count ?? 0,
    },
    { status: 201 }
  );
}
