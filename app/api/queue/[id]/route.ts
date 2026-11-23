import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { QueueItem } from "@/lib/database.types";

type QueueAction = "up" | "down" | "remove" | "skip" | "play-now";

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
  "up",
  "down",
  "remove",
  "skip",
  "play-now",
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Controles del anfitrión dueño de la sesión sobre un item de la cola:
 * - up / down: intercambia `position` con el vecino 'pending'
 * - remove: elimina la fila
 * - skip: marca como 'skipped'
 * - play-now: marca el 'playing' actual como 'played' y pone este item en 'playing'
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const action =
    typeof body.action === "string" && ALLOWED_ACTIONS.has(body.action)
      ? (body.action as QueueAction)
      : null;

  if (!action) {
    return NextResponse.json(
      {
        error:
          "Acción inválida. Usa: up, down, remove, skip o play-now.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: itemData, error: itemError } = await supabase
    .from("queue_items")
    .select(
      "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (itemError) {
    return NextResponse.json(
      { error: "No se pudo consultar la canción en la cola." },
      { status: 500 }
    );
  }

  const item = itemData as QueueItem | null;
  if (!item) {
    return NextResponse.json(
      { error: "Canción no encontrada en la cola." },
      { status: 404 }
    );
  }

  // Verificar que el usuario sea el dueño de la sesión
  const { data: session } = await supabase
    .from("sessions")
    .select("id, owner_id")
    .eq("id", item.session_id)
    .maybeSingle();

  if (!session || session.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo el anfitrión dueño puede modificar esta cola." },
      { status: 403 }
    );
  }

  if (action === "remove") {
    const { error } = await supabase.from("queue_items").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "No se pudo eliminar la canción." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, removedId: id });
  }

  if (action === "skip") {
    const { data: updated, error } = await supabase
      .from("queue_items")
      .update({ status: "skipped" })
      .eq("id", id)
      .select(
        "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "No se pudo saltar la canción." },
        { status: 500 }
      );
    }
    return NextResponse.json({ item: updated });
  }

  if (action === "play-now") {
    // Marcar la canción actual en reproducción como 'played'
    await supabase
      .from("queue_items")
      .update({ status: "played" })
      .eq("session_id", item.session_id)
      .eq("status", "playing")
      .neq("id", item.id);

    const { data: updated, error } = await supabase
      .from("queue_items")
      .update({ status: "playing" })
      .eq("id", id)
      .select(
        "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "No se pudo reproducir la canción." },
        { status: 500 }
      );
    }
    return NextResponse.json({ item: updated });
  }

  // Acciones 'up' y 'down': reordenar entre los items 'pending' de la sesión
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: "Solo se pueden reordenar canciones pendientes." },
      { status: 400 }
    );
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from("queue_items")
    .select("id, position")
    .eq("session_id", item.session_id)
    .eq("status", "pending")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (pendingError || !pendingRows) {
    return NextResponse.json(
      { error: "No se pudo leer el orden de la cola." },
      { status: 500 }
    );
  }

  const list = pendingRows as Array<{ id: string; position: number }>;
  const currentIndex = list.findIndex((row) => row.id === item.id);
  const targetIndex = action === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= list.length) {
    return NextResponse.json({ ok: true, swapped: false });
  }

  const currentRow = list[currentIndex];
  const neighborRow = list[targetIndex];

  // Si por algún motivo dos filas compartían position, normalizar las posiciones primero
  if (currentRow.position === neighborRow.position) {
    const reordered = [...list];
    reordered[currentIndex] = neighborRow;
    reordered[targetIndex] = currentRow;

    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("queue_items")
        .update({ position: i + 1 })
        .eq("id", reordered[i].id);
    }
  } else {
    await Promise.all([
      supabase
        .from("queue_items")
        .update({ position: neighborRow.position })
        .eq("id", currentRow.id),
      supabase
        .from("queue_items")
        .update({ position: currentRow.position })
        .eq("id", neighborRow.id),
    ]);
  }

  return NextResponse.json({ ok: true, swapped: true });
}
