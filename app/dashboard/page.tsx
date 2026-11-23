import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Mic2, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Panel del anfitrión para gestionar sesiones de karaoke.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader user={user} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Hola, {user.display_name || user.username}
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Sesión iniciada correctamente como{" "}
              <span className="font-mono text-ink">@{user.username}</span> (
              {user.role === "admin" ? "Administrador" : "Anfitrión"}).
            </p>
          </div>

          {user.role === "admin" && (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-white/20 hover:bg-elevated"
            >
              <Users className="h-4 w-4 text-stage" aria-hidden="true" />
              Administrar usuarios
            </Link>
          )}
        </div>

        <section className="surface-card mt-8 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ok/15 text-ok">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stage">
                Fase 2 · Autenticación lista
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Tu cuenta de anfitrión ya funciona
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
                En la <strong className="text-ink">Fase 3</strong> aparecerá
                aquí el panel completo para crear sesiones de fiesta, generar
                códigos QR públicos y cerrar sesiones activas.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-canvas/80 px-3.5 py-2 text-xs text-ink-muted">
                <Mic2 className="h-4 w-4 text-stage" aria-hidden="true" />
                Siguiente paso: Fase 3 (Sesiones y QR)
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
