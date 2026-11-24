import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  UNPLAYABLE_VIDEO_MESSAGE,
  verifyYoutubeVideoForQueue,
} from "@/lib/youtube/verify";
import { computeFairInsertIndex } from "@/lib/queue/fairOrder";
import type { QueueItem, Session } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { code } = await context.params;
  const cleanCode = code?.trim().toLowerCase();
  if (!cleanCode) {
    return NextResponse.json(
      { error: "Código de sesión inválido." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select("id, code, name, is_active, created_at, closed_at")
    .eq("code", cleanCode)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      { error: "No se pudo consultar la sesión." },
      { status: 500 }
    );
  }

  if (!sessionData) {
    return NextResponse.json(
      { error: "Sesión no encontrada." },
      { status: 404 }
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("queue_items")
    .select(
      "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
    )
    .eq("session_id", sessionData.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsError) {
    return NextResponse.json(
      { error: "No se pudo cargar la cola." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    session: sessionData,
    items: (items ?? []) as QueueItem[],
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { code } = await context.params;
  const cleanCode = code?.trim().toLowerCase();
  if (!cleanCode) {
    return NextResponse.json(
      { error: "Código de sesión inválido." },
      { status: 400 }
    );
  }

  let body: {
    youtubeVideoId?: unknown;
    youtube_video_id?: unknown;
    title?: unknown;
    artist?: unknown;
    requestedBy?: unknown;
    requested_by?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const youtubeVideoId = (
    typeof body.youtubeVideoId === "string"
      ? body.youtubeVideoId
      : typeof body.youtube_video_id === "string"
        ? body.youtube_video_id
        : ""
  ).trim();

  if (!youtubeVideoId) {
    return NextResponse.json(
      { error: "Falta el identificador del video de YouTube." },
      { status: 400 }
    );
  }

  const rawRequestedBy =
    typeof body.requestedBy === "string"
      ? body.requestedBy
      : typeof body.requested_by === "string"
        ? body.requested_by
        : "";
  const requestedBy = rawRequestedBy.trim().slice(0, 30) || "Invitado";

  const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
  const rawArtist =
    typeof body.artist === "string" ? body.artist.trim() || null : null;

  const supabase = getSupabaseServerClient();

  // 1. Verificar que la sesión exista y esté activa
  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select("id, code, name, is_active")
    .eq("code", cleanCode)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      { error: "No se pudo consultar la sesión." },
      { status: 500 }
    );
  }

  const session = sessionData as Pick<
    Session,
    "id" | "code" | "name" | "is_active"
  > | null;

  if (!session) {
    return NextResponse.json(
      { error: "Sesión no encontrada." },
      { status: 404 }
    );
  }

  if (!session.is_active) {
    return NextResponse.json(
      { error: "Esta sesión terminó 🎤" },
      { status: 409 }
    );
  }

  // 2. Verificación obligatoria en servidor antes de entrar a la cola
  let verification;
  try {
    verification = await verifyYoutubeVideoForQueue(youtubeVideoId, {
      title: rawTitle,
      artist: rawArtist,
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

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.reason || UNPLAYABLE_VIDEO_MESSAGE },
      { status: 422 }
    );
  }

  // 3. Leer cola actual para ubicar la canción con turnos justos (intercalando cantantes)
  const { data: existingQueueData, error: queueReadError } = await supabase
    .from("queue_items")
    .select("id, requested_by, position, status, created_at")
    .eq("session_id", session.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (queueReadError) {
    return NextResponse.json(
      { error: "No se pudo leer la cola actual." },
      { status: 500 }
    );
  }

  const existingQueue = (existingQueueData ?? []) as Array<
    Pick<QueueItem, "id" | "requested_by" | "position" | "status" | "created_at">
  >;

  const playingItem =
    existingQueue.find((row) => row.status === "playing") ?? null;
  const pendingItems = existingQueue.filter((row) => row.status === "pending");

  const maxNonPendingPos = existingQueue
    .filter((row) => row.status !== "pending")
    .reduce((max, row) => Math.max(max, row.position), 0);

  const maxOverallPos = existingQueue.reduce(
    (max, row) => Math.max(max, row.position),
    0
  );

  const insertIndex = computeFairInsertIndex(
    playingItem,
    pendingItems,
    requestedBy
  );

  const finalTitle = (
    rawTitle ||
    verification.song?.title ||
    `Video ${youtubeVideoId}`
  ).slice(0, 160);
  const finalArtist = (rawArtist ?? verification.song?.artist ?? null)?.slice(
    0,
    100
  ) ?? null;

  const { data: inserted, error: insertError } = await supabase
    .from("queue_items")
    .insert({
      session_id: session.id,
      song_id: verification.song?.id ?? null,
      youtube_video_id: youtubeVideoId,
      title: finalTitle,
      artist: finalArtist,
      requested_by: requestedBy,
      position: maxOverallPos + 1,
      status: "pending",
    })
    .select(
      "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
    )
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "No se pudo agregar la canción a la cola." },
      { status: 500 }
    );
  }

  const insertedItem = inserted as QueueItem;

  // Si corresponde intercalar antes del final, re-secuenciar las posiciones pendientes
  const orderedPendingIds = pendingItems.map((row) => row.id);
  orderedPendingIds.splice(insertIndex, 0, insertedItem.id);

  const basePosition = maxNonPendingPos + 1;
  let finalPosition = insertedItem.position;

  if (insertIndex < pendingItems.length) {
    const updates = orderedPendingIds.map((itemId, idx) => {
      const nextPos = basePosition + idx;
      if (itemId === insertedItem.id) {
        finalPosition = nextPos;
      }
      return supabase
        .from("queue_items")
        .update({ position: nextPos })
        .eq("id", itemId);
    });
    await Promise.all(updates);
  }

  return NextResponse.json(
    {
      item: {
        ...insertedItem,
        position: finalPosition,
      },
      queuePosition: insertIndex + 1,
    },
    { status: 201 }
  );
}
