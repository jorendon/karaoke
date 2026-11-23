import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  let body: {
    is_active?: unknown;
    display_name?: unknown;
    role?: unknown;
    password?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.is_active === "boolean") {
    if (id === auth.user.id && body.is_active === false) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propia cuenta." },
        { status: 400 }
      );
    }
    updates.is_active = body.is_active;
  }

  if (body.role === "admin" || body.role === "host") {
    if (id === auth.user.id && body.role !== "admin") {
      return NextResponse.json(
        { error: "No puedes quitarte el rol de administrador a ti mismo." },
        { status: 400 }
      );
    }
    updates.role = body.role;
  }

  if (typeof body.display_name === "string") {
    updates.display_name = body.display_name.trim().slice(0, 60) || null;
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }
    updates.password_hash = await hashPassword(body.password);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No hay cambios para aplicar." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_users")
    .update(updates)
    .eq("id", id)
    .select("id, username, display_name, role, is_active, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar el usuario." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("app_users").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo eliminar el usuario." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
