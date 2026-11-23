import Link from "next/link";
import { ArrowLeft, Mic2 } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <div className="surface-card w-full rounded-2xl p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stage/15 text-stage">
          <Mic2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-widest text-stage">
          Error 404
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink">
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          El enlace que abriste no existe o la sesión ya no está disponible.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stage px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
