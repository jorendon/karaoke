import "server-only";

/**
 * Validación de variables de entorno EXCLUSIVAS DEL SERVIDOR.
 * Protegido con `server-only` para garantizar en tiempo de compilación que
 * ninguna clave secreta termine en el bundle del navegador.
 */

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return (
    trimmed.includes("tu-service-role") ||
    trimmed.includes("tu-youtube-api") ||
    trimmed.includes("cambia-esto")
  );
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en .env.local"
    );
  }
  return key;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "Falta la variable de entorno AUTH_SECRET (mínimo 16 caracteres) en .env.local"
    );
  }
  return secret;
}

export function getYoutubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Falta la variable de entorno YOUTUBE_API_KEY en .env.local"
    );
  }
  return key;
}

export function getServerEnvStatus() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("tu-proyecto")
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("tu-anon-key")
    ),
    SUPABASE_SERVICE_ROLE_KEY: !isPlaceholder(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    AUTH_SECRET:
      !isPlaceholder(process.env.AUTH_SECRET) &&
      (process.env.AUTH_SECRET?.trim().length ?? 0) >= 16,
    YOUTUBE_API_KEY: !isPlaceholder(process.env.YOUTUBE_API_KEY),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  };
}
