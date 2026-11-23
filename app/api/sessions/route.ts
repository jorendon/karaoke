import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildSessionPublicUrl,
  generateSessionCode,
  generateSessionQrDataUrl,
} from "@/lib/sessions";
import type { Session } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  const supabase = getSupabaseServerClient();
  const { data: sessionsData, error } = await supabase
    .from("sessions")
    .select("id, code, name, owner_id, is_active, created_at, closed_at")
    .eq("owner_id", auth.user.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "No se pudieron obtener tus sesiones." },
      { status: 500 }
    );
  }

  const sessions = (sessionsData ?? []) as Session[];
  const sessionIds = sessions.map((s) => s.id);

  const queueCounts = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: queueRows } = await supabase
      .from("queue_items")
      .select("session_id")
      .in("session_id", sessionIds)
      .in("status", ["pending", "playing"]);

    for (const row of queueRows ?? []) {
      const sid = (row as { session_id: string }).session_id;
      queueCounts.set(sid, (queueCounts.get(sid) ?? 0) + 1);
    }
  }

  const enriched = sessions.map((session) => ({
    ...session,
    publicUrl: buildSessionPublicUrl(session.code),
    activeQueueCount: queueCounts.get(session.id) ?? 0,
  }));

  return NextResponse.json({ sessions: enriched });
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
      {
        error:
          "Escribe un nombre para la sesión (entre 1 y 80 caracteres).",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  let created: Session | null = null;

  // Reintenta hasta 5 veces ante la remota colisión de código único
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSessionCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        code,
        name,
        owner_id: auth.user.id,
        is_active: true,
      })
      .select("id, code, name, owner_id, is_active, created_at, closed_at")
      .single();

    if (!error && data) {
      created = data as Session;
      break;
    }

    if (error?.code !== "23505") {
      return NextResponse.json(
        { error: "No se pudo crear la sesión." },
        { status: 500 }
      );
    }
  }

  if (!created) {
    return NextResponse.json(
      { error: "No se pudo generar un código único. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const { publicUrl, qrDataUrl } = await generateSessionQrDataUrl(created.code);

  return NextResponse.json(
    {
      session: {
        ...created,
        publicUrl,
        activeQueueCount: 0,
      },
      publicUrl,
      qrDataUrl,
    },
    { status: 201 }
  );
}
