import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { computeFairShuffledOrder } from "@/lib/queue/fairOrder";
import type { QueueItem } from "@/lib/database.types";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Mezcla aleatoriamente la cola pendiente por rondas justas de cantantes
 * (sin repetir a la misma persona seguida cuando haya otros esperando).
 * Solo permitido al anfitrión dueño de la sesión.
 */
export async function POST(_request: Request, context: RouteContext) {
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

  const supabase = getSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, owner_id")
    .eq("code", cleanCode)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Sesión no encontrada." },
      { status: 404 }
    );
  }

  if (session.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo el anfitrión dueño puede mezclar esta cola." },
      { status: 403 }
    );
  }

  const { data: queueData, error: queueError } = await supabase
    .from("queue_items")
    .select("id, requested_by, position, status, created_at")
    .eq("session_id", session.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (queueError) {
    return NextResponse.json(
      { error: "No se pudo leer la cola." },
      { status: 500 }
    );
  }

  const items = (queueData ?? []) as Array<
    Pick<QueueItem, "id" | "requested_by" | "position" | "status" | "created_at">
  >;

  const playingItem = items.find((row) => row.status === "playing") ?? null;
  const pendingItems = items.filter((row) => row.status === "pending");

  if (pendingItems.length <= 1) {
    return NextResponse.json({ ok: true, shuffledCount: pendingItems.length });
  }

  const maxNonPendingPos = items
    .filter((row) => row.status !== "pending")
    .reduce((max, row) => Math.max(max, row.position), 0);

  const fairShuffled = computeFairShuffledOrder(playingItem, pendingItems);
  const basePosition = maxNonPendingPos + 1;

  await Promise.all(
    fairShuffled.map((item, idx) =>
      supabase
        .from("queue_items")
        .update({ position: basePosition + idx })
        .eq("id", item.id)
    )
  );

  return NextResponse.json({
    ok: true,
    shuffledCount: fairShuffled.length,
  });
}
