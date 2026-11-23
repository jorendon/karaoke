"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <div className="surface-card w-full rounded-2xl p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-live/15 text-live">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">
          Ocurrió un error inesperado
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          No te preocupes, puedes intentar recargar esta vista o volver al
          inicio.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-stage px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-elevated"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
