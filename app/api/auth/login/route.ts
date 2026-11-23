import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { verifyDummyPassword, verifyPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSessionTokenForUser,
} from "@/lib/auth/session";
import type { AppUser } from "@/lib/database.types";

const INVALID_CREDENTIALS_MESSAGE = "Usuario o contraseña incorrectos";

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const rawUsername =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const rawPassword = typeof body.password === "string" ? body.password : "";

  if (!rawUsername || !rawPassword) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_MESSAGE },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("app_users")
      .select(
        "id, username, password_hash, display_name, role, is_active, created_at"
      )
      .eq("username", rawUsername)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Error interno al verificar credenciales." },
        { status: 500 }
      );
    }

    const user = data as AppUser | null;

    if (!user || !user.is_active) {
      await verifyDummyPassword(rawPassword);
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 }
      );
    }

    const validPassword = await verifyPassword(rawPassword, user.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 }
      );
    }

    const token = await createSessionTokenForUser({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
      },
    });

    attachSessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo iniciar sesión. Verifica que AUTH_SECRET y Supabase estén configurados.",
      },
      { status: 500 }
    );
  }
}
