import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  let body: { title?: unknown; artist?: unknown; genre?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const updates: Record<string, string | null> = {};

  if (typeof body.title === "string") {
    const cleanTitle = body.title.trim().slice(0, 160);
    if (!cleanTitle) {
      return NextResponse.json(
        { error: "El título no puede quedar vacío." },
        { status: 400 }
      );
    }
    updates.title = cleanTitle;
  }

  if (typeof body.artist === "string") {
    updates.artist = body.artist.trim().slice(0, 100) || null;
  } else if (body.artist === null) {
    updates.artist = null;
  }

  if (typeof body.genre === "string") {
    updates.genre = body.genre.trim().slice(0, 60) || null;
  } else if (body.genre === null) {
    updates.genre = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No hay campos para actualizar." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("songs")
    .update(updates)
    .eq("id", id)
    .select(
      "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar la canción." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Canción no encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ song: data });
}
