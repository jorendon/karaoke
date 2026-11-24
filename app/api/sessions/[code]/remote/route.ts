import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type RemoteTvCommand =
  | "toggle-play"
  | "play"
  | "pause"
  | "toggle-queue"
  | "toggle-qr"
  | "cinema-mode"
  | "show-panels";

const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  "toggle-play",
  "play",
  "pause",
  "toggle-queue",
  "toggle-qr",
  "cinema-mode",
  "show-panels",
]);

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Envía un comando en vivo desde el control remoto del anfitrión (`/remote/[code]`)
 * hacia la pantalla de la TV (`/host/[code]`) usando Supabase Realtime Broadcast
 * por HTTP (sin WebSockets en serverless y verificado contra el dueño de la sesión).
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

  let body: { command?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const command =
    typeof body.command === "string" && ALLOWED_COMMANDS.has(body.command)
      ? (body.command as RemoteTvCommand)
      : null;

  if (!command) {
    return NextResponse.json(
      { error: "Comando de control remoto inválido." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, owner_id, is_active")
    .eq("code", cleanCode)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json(
      { error: "Sesión no encontrada." },
      { status: 404 }
    );
  }

  if (session.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo el anfitrión dueño puede controlar esta TV." },
      { status: 403 }
    );
  }

  const channel = supabase.channel(`karaoke-remote-${session.id}`);
  try {
    const result = await channel.httpSend("remote-command", {
      command,
      ts: Date.now(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "No se pudo enviar el comando a la TV." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, command });
  } finally {
    await supabase.removeChannel(channel);
  }
}
