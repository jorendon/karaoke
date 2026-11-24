import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { PublicAppUser } from "@/lib/database.types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionTokenPayload,
} from "@/lib/auth/jwt";

export function attachSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function createSessionTokenForUser(
  user: Pick<PublicAppUser, "id" | "username" | "role">,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  return signSessionToken(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    maxAgeSeconds
  );
}

export async function getSessionPayload(): Promise<SessionTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Obtiene el usuario actual verificando tanto la firma del JWT como su estado
 * vigente en `app_users` (`is_active = true`). Si fue eliminado o desactivado,
 * devuelve null inmediatamente.
 */
export async function getCurrentUser(): Promise<PublicAppUser | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, display_name, role, is_active, created_at")
      .eq("id", payload.userId)
      .maybeSingle();

    if (error || !data || !data.is_active) {
      return null;
    }

    return data as PublicAppUser;
  } catch {
    return null;
  }
}

export async function requireCurrentUser(): Promise<
  { user: PublicAppUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export async function requireAdminUser(): Promise<
  { user: PublicAppUser; response?: never } | { user?: never; response: NextResponse }
> {
  const result = await requireCurrentUser();
  if (result.response) return result;

  if (result.user.role !== "admin") {
    return {
      response: NextResponse.json(
        { error: "Acceso restringido a administradores." },
        { status: 403 }
      ),
    };
  }

  return result;
}
