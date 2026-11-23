import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getSupabaseServiceRoleKey } from "@/lib/env.server";

let serverClient: SupabaseClient | null = null;

/**
 * Cliente Supabase exclusivo del servidor con service_role key.
 * Ignora RLS y se utiliza en rutas API y Server Components para lecturas
 * privadas (como app_users) y todas las escrituras en base de datos.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (!serverClient) {
    const { supabaseUrl } = getPublicEnv();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    serverClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClient;
}
