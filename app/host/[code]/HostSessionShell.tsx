"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2, PowerOff } from "lucide-react";
import { SessionQrCard } from "@/components/SessionQrCard";

interface HostCloseButtonProps {
  code: string;
  name: string;
  isActive: boolean;
}

export function HostCloseButton({
  code,
  name,
  isActive,
}: HostCloseButtonProps) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(!isActive);

  async function handleClose() {
    const confirmed = window.confirm(
      `¿Cerrar la sesión "${name}"? Los invitados ya no podrán agregar canciones.`
    );
    if (!confirmed) return;

    setClosing(true);
    try {
      const response = await fetch(`/api/sessions/${code}/close`, {
        method: "POST",
      });
      if (response.ok) {
        setClosed(true);
        router.refresh();
      }
    } finally {
      setClosing(false);
    }
  }

  if (closed) {
    return (
      <div className="rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-center text-sm font-medium text-live">
        Esta sesión está cerrada
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      disabled={closing}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm font-semibold text-live transition-colors hover:bg-live/20 disabled:opacity-50"
    >
      {closing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cerrando...
        </>
      ) : (
        <>
          <PowerOff className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </>
      )}
    </button>
  );
}

interface HostSessionShellProps {
  code: string;
  name: string;
  isActive: boolean;
  publicUrl: string;
  qrDataUrl: string;
}

export function HostSessionShell({
  code,
  name,
  isActive,
  publicUrl,
  qrDataUrl,
}: HostSessionShellProps) {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3.5 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al dashboard
          </Link>

          <span
            className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
              isActive
                ? "bg-ok/15 text-ok"
                : "bg-live/15 text-live"
            }`}
          >
            {isActive ? "Sesión en vivo" : "Sesión cerrada"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Izquierda: Cola (Fase 5-6) */}
          <aside className="surface-card order-2 rounded-2xl p-6 lg:order-1 lg:col-span-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary">
              Cola de canciones
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              La cola sincronizada en tiempo real con controles ↑ ↓ ✕ se
              activará en las Fases 5 y 6.
            </p>
          </aside>

          {/* Centro: Reproductor YouTube (Fase 6) */}
          <main className="surface-card order-1 rounded-2xl p-6 lg:order-2 lg:col-span-6">
            <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-canvas/80 p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-stage">
                Fase 3 · Sesión y QR listos
              </p>
              <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
                {name}
              </h1>
              <p className="mt-2 max-w-md text-sm text-ink-secondary">
                Ya puedes escanear el código QR con tu celular para comprobar la
                vista pública del invitado. El reproductor de YouTube con
                auto-avance llegará en la Fase 6.
              </p>
            </div>
          </main>

          {/* Derecha: Panel de sesión + QR */}
          <aside className="surface-card order-3 flex flex-col justify-between gap-6 rounded-2xl p-6 lg:col-span-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stage">
                Código {code}
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink">{name}</h2>

              <div className="mt-6">
                <SessionQrCard
                  code={code}
                  name={name}
                  initialPublicUrl={publicUrl}
                  initialQrDataUrl={qrDataUrl}
                  compact
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <HostCloseButton code={code} name={name} isActive={isActive} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
