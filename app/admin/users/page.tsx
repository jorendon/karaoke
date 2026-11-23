import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicAppUser } from "@/lib/database.types";
import { AppHeader } from "@/components/AppHeader";
import { AdminUsersClient } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración de usuarios",
  description: "Gestiona las cuentas de anfitriones y administradores.",
};

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, username, display_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  const users = (data ?? []) as PublicAppUser[];

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Administración de usuarios
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary">
            Solo las cuentas activas en esta lista pueden iniciar sesión, crear
            sesiones de karaoke y controlar el reproductor.
          </p>
        </div>

        <AdminUsersClient initialUsers={users} currentUserId={user.id} />
      </main>
    </div>
  );
}
