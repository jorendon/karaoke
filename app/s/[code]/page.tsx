import type { Metadata } from "next";
import { Mic2, Radio } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Fiesta ${code}`,
    description: "Pide tu canción de karaoke desde tu celular.",
  };
}

export default async function GuestSessionPage({ params }: PageProps) {
  const { code } = await params;
  const cleanCode = code.trim().toLowerCase();

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, code, name, is_active, closed_at")
    .eq("code", cleanCode)
    .maybeSingle();

  const session = data as Pick<
    Session,
    "id" | "code" | "name" | "is_active" | "closed_at"
  > | null;

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <div className="surface-card w-full rounded-2xl p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-live/15 text-live">
            <Mic2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-ink">
            Sesión no encontrada
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            El código{" "}
            <span className="font-mono text-ink">{cleanCode}</span> no existe o
            el enlace es incorrecto. Pídele al anfitrión que te muestre el QR
            nuevamente.
          </p>
        </div>
      </main>
    );
  }

  if (!session.is_active) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <div className="surface-card w-full rounded-2xl p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            {session.name}
          </p>
          <h1 className="mt-3 text-2xl font-bold text-ink">
            Esta sesión terminó 🎤
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Gracias por cantar. El anfitrión ya cerró esta fiesta y no se pueden
            agregar más canciones.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8 sm:px-6">
      <header className="surface-card rounded-2xl p-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1 text-xs font-semibold text-ok">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Sesión en vivo
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {session.name}
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-muted">
          Código: {session.code}
        </p>
      </header>

      <section className="surface-card mt-6 rounded-2xl p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-stage/15 text-stage">
          <Mic2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-lg font-semibold text-ink">
          ¡Conectado a la fiesta!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          El enlace público y el código QR ya funcionan sin iniciar sesión. En
          las Fases 4 a 6 aquí aparecerá el buscador de canciones y la cola en
          vivo.
        </p>
      </section>
    </main>
  );
}
