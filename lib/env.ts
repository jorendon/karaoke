/**
 * Validación de variables de entorno PÚBLICAS (seguras para navegador y servidor).
 * Ninguna clave secreta debe leerse ni exportarse desde este archivo.
 */

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return (
    trimmed.includes("tu-proyecto") ||
    trimmed.includes("tu-anon-key") ||
    trimmed.includes("cambia-esto")
  );
}

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");

  if (!supabaseUrl) {
    throw new Error(
      "Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL en .env.local"
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Falta la variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    appUrl,
  };
}

export function getPublicAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function getPublicEnvStatus() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: !isPlaceholder(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !isPlaceholder(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  };
}
