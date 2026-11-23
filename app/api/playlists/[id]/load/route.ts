import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { verifyYoutubeVideoForQueue } from "@/lib/youtube/verify";
import type { PlaylistItem } from "@/lib/database.types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Carga todas las canciones válidas de una playlist guardada a la cola de una
 * sesión activa del mismo anfitrión, verificando cada video en el servidor
 * antes de insertarlo (usando la caché de 30 días en `songs`).
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const { id: playlistId } = await context.params;
  if (!playlistId) {
    return NextResponse.json(
      { error: "ID de playlist requerido." },
      { status: 400 }
    );
  }

  let body: { sessionCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const sessionCode =
    typeof body.sessionCode === "string"
      ? body.sessionCode.trim().toLowerCase()
      : "";

  if (!sessionCode) {
    return NextResponse.json(
      { error: "Selecciona una sesión activa para cargar la playlist." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const [{ data: playlist }, { data: session }] = await Promise.all([
    supabase
      .from("playlists")
      .select("id, owner_id, name")
      .eq("id", playlistId)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("id, code, name, owner_id, is_active")
      .eq("code", sessionCode)
      .maybeSingle(),
  ]);

  if (!playlist || playlist.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Playlist no encontrada o sin permiso." },
      { status: 404 }
    );
  }

  if (!session || session.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Sesión no encontrada o sin permiso." },
      { status: 404 }
    );
  }

  if (!session.is_active) {
    return NextResponse.json(
      { error: "No puedes cargar una playlist en una sesión cerrada." },
      { status: 409 }
    );
  }

  const { data: itemsData } = await supabase
    .from("playlist_items")
    .select(
      "id, playlist_id, song_id, youtube_video_id, title, artist, position, created_at"
    )
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const playlistItems = (itemsData ?? []) as PlaylistItem[];
  if (playlistItems.length === 0) {
    return NextResponse.json(
      { error: "Esta playlist está vacía." },
      { status: 400 }
    );
  }

  const { data: maxRow } = await supabase
    .from("queue_items")
    .select("position")
    .eq("session_id", session.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextPosition =
    ((maxRow as { position: number } | null)?.position ?? 0) + 1;

  const requestedBy = (auth.user.display_name || auth.user.username).slice(
    0,
    30
  );

  const rowsToInsert: Array<{
    session_id: string;
    song_id: string | null;
    youtube_video_id: string;
    title: string;
    artist: string | null;
    requested_by: string;
    position: number;
    status: "pending";
  }> = [];

  let skippedCount = 0;

  for (const item of playlistItems) {
    try {
      const check = await verifyYoutubeVideoForQueue(item.youtube_video_id, {
        title: item.title,
        artist: item.artist,
      });

      if (!check.valid) {
        skippedCount++;
        continue;
      }

      rowsToInsert.push({
        session_id: session.id,
        song_id: check.song?.id ?? item.song_id,
        youtube_video_id: item.youtube_video_id,
        title: item.title,
        artist: item.artist,
        requested_by: requestedBy,
        position: nextPosition++,
        status: "pending",
      });
    } catch {
      skippedCount++;
    }
  }

  if (rowsToInsert.length === 0) {
    return NextResponse.json(
      {
        error:
          "Ninguna canción de la playlist pasó la verificación de reproducción en YouTube.",
      },
      { status: 422 }
    );
  }

  const { error: insertError } = await supabase
    .from("queue_items")
    .insert(rowsToInsert);

  if (insertError) {
    return NextResponse.json(
      { error: "No se pudieron agregar las canciones a la cola." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    addedCount: rowsToInsert.length,
    skippedCount,
    sessionCode: session.code,
    sessionName: session.name,
  });
}
