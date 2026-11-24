import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/database.types";

export const SESSION_COOKIE_NAME = "karaoke_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días por defecto
export const SESSION_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días (ideal para TV)

export interface SessionTokenPayload {
  userId: string;
  username: string;
  role: UserRole;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET no está configurada o es demasiado corta (mínimo 16 caracteres)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionTokenPayload,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionTokenPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    const userId = payload.userId;
    const username = payload.username;
    const role = payload.role;

    if (
      typeof userId !== "string" ||
      typeof username !== "string" ||
      (role !== "admin" && role !== "host")
    ) {
      return null;
    }

    return { userId, username, role };
  } catch {
    return null;
  }
}
