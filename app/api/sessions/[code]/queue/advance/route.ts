import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { QueueItem } from "@/lib/database.types";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Avanza la cola de una sesión (solo el anfitrión dueño):
 * - Marca el item 'playing' actual como 'played' (o 'skipped' si falló el reproductor).
 * - Promueve el siguiente item 'pending' (menor position) a 'playing'.
 * - Devuelve el nuevo item 'playing' (o null si la cola quedó vacía).
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const { code } = await context.params;
  const cleanCode = code?.trim().toLowerCase();
  if (!cleanCode) {
    return NextResponse.json(
      { error: "Código de sesión inválido." },
      { status: 400 }
    );
  }

  let markCurrentAs: "played" | "skipped" = "played";
  try {
    const body = (await request.json()) as { markAs?: unknown };
    if (body?.markAs === "skipped") {
      markCurrentAs = "skipped";
    }
  } catch {
    // Body vacío es completamente válido
  }

  const supabase = getSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, owner_id, is_active")
    .eq("code", cleanCode)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      { error: "No se pudo consultar la sesión." },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json(
      { error: "Sesión no encontrada." },
      { status: 404 }
    );
  }

  if (session.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo el anfitrión dueño puede controlar esta cola." },
      { status: 403 }
    );
  }

  // 1. Marcar cualquier 'playing' actual como 'played' o 'skipped'
  const { error: markError } = await supabase
    .from("queue_items")
    .update({ status: markCurrentAs })
    .eq("session_id", session.id)
    .eq("status", "playing");

  if (markError) {
    return NextResponse.json(
      { error: "No se pudo actualizar la canción actual." },
      { status: 500 }
    );
  }

  // 2. Buscar siguiente 'pending' con menor position
  const { data: nextPending, error: nextError } = await supabase
    .from("queue_items")
    .select(
      "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
    )
    .eq("session_id", session.id)
    .eq("status", "pending")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextError) {
    return NextResponse.json(
      { error: "No se pudo buscar la siguiente canción." },
      { status: 500 }
    );
  }

  if (!nextPending) {
    return NextResponse.json({ current: null });
  }

  const { data: promoted, error: promoteError } = await supabase
    .from("queue_items")
    .update({ status: "playing" })
    .eq("id", nextPending.id)
    .select(
      "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
    )
    .single();

  if (promoteError) {
    return NextResponse.json(
      { error: "No se pudo iniciar la siguiente canción." },
      { status: 500 }
    );
  }

  return NextResponse.json({ current: promoted as QueueItem });
}
