import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import type { UserRole } from "@/lib/database.types";

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, display_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "No se pudieron obtener los usuarios." },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  let body: {
    username?: unknown;
    password?: unknown;
    display_name?: unknown;
    role?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.display_name === "string" && body.display_name.trim()
      ? body.display_name.trim().slice(0, 60)
      : null;
  const role: UserRole = body.role === "admin" ? "admin" : "host";

  if (!USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      {
        error:
          "El usuario debe tener entre 3 y 32 caracteres (solo letras minúsculas, números, '.', '_' o '-').",
      },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      username,
      password_hash: passwordHash,
      display_name: displayName,
      role,
      is_active: true,
    })
    .select("id, username, display_name, role, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese nombre." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo crear el usuario." },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: data }, { status: 201 });
}
