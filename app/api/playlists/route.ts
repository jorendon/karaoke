import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Playlist, PlaylistItem } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export interface PlaylistWithItems extends Playlist {
  items: PlaylistItem[];
}

export async function GET() {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const supabase = getSupabaseServerClient();
  const { data: playlistsData, error } = await supabase
    .from("playlists")
    .select("id, owner_id, name, created_at")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar tus playlists." },
      { status: 500 }
    );
  }

  const playlists = (playlistsData ?? []) as Playlist[];
  const playlistIds = playlists.map((p) => p.id);

  const itemsByPlaylist = new Map<string, PlaylistItem[]>();
  if (playlistIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("playlist_items")
      .select(
        "id, playlist_id, song_id, youtube_video_id, title, artist, position, created_at"
      )
      .in("playlist_id", playlistIds)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    for (const row of (itemsData ?? []) as PlaylistItem[]) {
      const list = itemsByPlaylist.get(row.playlist_id) ?? [];
      list.push(row);
      itemsByPlaylist.set(row.playlist_id, list);
    }
  }

  const result: PlaylistWithItems[] = playlists.map((p) => ({
    ...p,
    items: itemsByPlaylist.get(p.id) ?? [],
  }));

  return NextResponse.json({ playlists: result });
}

export async function POST(request: Request) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: "Escribe un nombre para la playlist (1 a 80 caracteres)." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("playlists")
    .insert({
      owner_id: auth.user.id,
      name,
    })
    .select("id, owner_id, name, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "No se pudo crear la playlist." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { playlist: { ...(data as Playlist), items: [] } },
    { status: 201 }
  );
}
