import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PlaylistItem } from "@/lib/database.types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

  let body: {
    songId?: unknown;
    youtubeVideoId?: unknown;
    title?: unknown;
    artist?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const youtubeVideoId =
    typeof body.youtubeVideoId === "string" ? body.youtubeVideoId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artist =
    typeof body.artist === "string" ? body.artist.trim() || null : null;
  const songId =
    typeof body.songId === "string" && body.songId.trim()
      ? body.songId.trim()
      : null;

  if (!youtubeVideoId || !title) {
    return NextResponse.json(
      { error: "Faltan youtubeVideoId y title." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, owner_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (!playlist) {
    return NextResponse.json(
      { error: "Playlist no encontrada." },
      { status: 404 }
    );
  }

  if (playlist.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para editar esta playlist." },
      { status: 403 }
    );
  }

  const { data: maxRow } = await supabase
    .from("playlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition =
    ((maxRow as { position: number } | null)?.position ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("playlist_items")
    .insert({
      playlist_id: playlistId,
      song_id: songId,
      youtube_video_id: youtubeVideoId,
      title: title.slice(0, 160),
      artist: artist ? artist.slice(0, 100) : null,
      position: nextPosition,
    })
    .select(
      "id, playlist_id, song_id, youtube_video_id, title, artist, position, created_at"
    )
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: "No se pudo agregar la canción a la playlist." },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: inserted as PlaylistItem }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const { id: playlistId } = await context.params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId")?.trim();

  if (!playlistId || !itemId) {
    return NextResponse.json(
      { error: "Se requieren playlistId y itemId." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, owner_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (!playlist || playlist.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para editar esta playlist." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("playlist_items")
    .delete()
    .eq("id", itemId)
    .eq("playlist_id", playlistId);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo quitar la canción de la playlist." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
