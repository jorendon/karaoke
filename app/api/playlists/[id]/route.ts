import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!playlist) {
    return NextResponse.json(
      { error: "Playlist no encontrada." },
      { status: 404 }
    );
  }

  if (playlist.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para eliminar esta playlist." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("playlists").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "No se pudo eliminar la playlist." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
