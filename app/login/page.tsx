import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mic2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso para anfitriones de Karaoke en Casa.",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="surface-card rounded-2xl p-8 sm:p-10">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stage/15 text-stage">
            <Mic2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Karaoke en Casa
            </h1>
            <p className="text-sm text-ink-secondary">
              Acceso para anfitriones
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-ink-muted">
          ¿Eres invitado en una fiesta? Escanea el código QR de la pantalla para
          pedir canciones sin iniciar sesión.
        </p>
      </div>
    </main>
  );
}
