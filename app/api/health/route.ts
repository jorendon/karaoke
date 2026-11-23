import { NextResponse } from "next/server";
import { getServerEnvStatus } from "@/lib/env.server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envStatus = getServerEnvStatus();
  const supabaseConfigured =
    envStatus.NEXT_PUBLIC_SUPABASE_URL &&
    envStatus.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    envStatus.SUPABASE_SERVICE_ROLE_KEY;

  let database: { connected: boolean; error?: string } = {
    connected: false,
    error: "Variables de Supabase no configuradas aún.",
  };

  if (supabaseConfigured) {
    try {
      const supabase = getSupabaseServerClient();
      const { error } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true });

      if (error) {
        database = {
          connected: false,
          error: error.message,
        };
      } else {
        database = { connected: true };
      }
    } catch (err) {
      database = {
        connected: false,
        error: err instanceof Error ? err.message : "Error de conexión",
      };
    }
  }

  return NextResponse.json({
    ok: database.connected,
    env: envStatus,
    database,
  });
}
