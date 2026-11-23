import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ code: string }>;
}

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
  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("id, code, name, owner_id, is_active, created_at, closed_at")
    .eq("code", cleanCode)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "No se pudo consultar la sesión." },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Sesión no encontrada." },
      { status: 404 }
    );
  }

  if (existing.owner_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo el anfitrión dueño puede cerrar esta sesión." },
      { status: 403 }
    );
  }

  if (!existing.is_active) {
    return NextResponse.json({ session: existing });
  }

  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({
      is_active: false,
      closed_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id, code, name, owner_id, is_active, created_at, closed_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "No se pudo cerrar la sesión." },
      { status: 500 }
    );
  }

  return NextResponse.json({ session: updated });
}
