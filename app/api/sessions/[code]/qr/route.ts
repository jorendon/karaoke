import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateSessionQrDataUrl } from "@/lib/sessions";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
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
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, code, name, owner_id, is_active")
    .eq("code", cleanCode)
    .maybeSingle();

  if (error) {
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
      { error: "Solo el anfitrión dueño puede generar este QR." },
      { status: 403 }
    );
  }

  const { publicUrl, qrDataUrl } = await generateSessionQrDataUrl(
    session.code
  );

  return NextResponse.json(
    {
      code: session.code,
      name: session.name,
      publicUrl,
      qrDataUrl,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
