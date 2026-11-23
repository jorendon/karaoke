"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente Supabase para el navegador (clave pública anon).
 * Solo se usa para LECTURA (catálogo, sesión, cola) y suscripciones Realtime.
 * Todas las escrituras pasan por las rutas API del servidor.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return browserClient;
}
