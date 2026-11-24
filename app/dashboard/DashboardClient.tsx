"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Mic2,
  Plus,
  PowerOff,
  QrCode,
  Radio,
  Smartphone,
  Tv,
  X,
} from "lucide-react";
import type { Session } from "@/lib/database.types";
import { SessionQrCard } from "@/components/SessionQrCard";
import {
  PlaylistsSection,
  type SavedPlaylist,
} from "@/components/PlaylistsSection";

export interface DashboardSession extends Session {
  publicUrl: string;
  activeQueueCount: number;
}

interface DashboardClientProps {
  initialSessions: DashboardSession[];
  initialPlaylists: SavedPlaylist[];
}

interface QrModalState {
  code: string;
  name: string;
  publicUrl: string;
  qrDataUrl: string;
}

export function DashboardClient({
  initialSessions,
  initialPlaylists,
}: DashboardClientProps) {
  const [sessions, setSessions] = useState<DashboardSession[]>(initialSessions);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [closingCode, setClosingCode] = useState<string | null>(null);
  const [loadingQrCode, setLoadingQrCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const activeSessions = sessions.filter((s) => s.is_active);
  const closedSessions = sessions.filter((s) => !s.is_active);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFeedback({
        type: "error",
        text: "Escribe un nombre para tu fiesta o sesión.",
      });
      return;
    }

    setCreating(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        session?: DashboardSession;
        publicUrl?: string;
        qrDataUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.session) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo crear la sesión.",
        });
        return;
      }

      setSessions((prev) => [data.session!, ...prev]);
      setNewName("");
      setFeedback({
        type: "success",
        text: `Sesión "${data.session.name}" creada con código ${data.session.code}.`,
      });

      if (data.qrDataUrl && data.publicUrl) {
        setQrModal({
          code: data.session.code,
          name: data.session.name,
          publicUrl: data.publicUrl,
          qrDataUrl: data.qrDataUrl,
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al crear la sesión.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenQr(session: DashboardSession) {
    setLoadingQrCode(session.code);
    setFeedback(null);
    try {
      const response = await fetch(`/api/sessions/${session.code}/qr`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        publicUrl?: string;
        qrDataUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.qrDataUrl || !data.publicUrl) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo generar el código QR.",
        });
        return;
      }

      setQrModal({
        code: session.code,
        name: session.name,
        publicUrl: data.publicUrl,
        qrDataUrl: data.qrDataUrl,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al generar el código QR.",
      });
    } finally {
      setLoadingQrCode(null);
    }
  }

  async function handleCloseSession(session: DashboardSession) {
    const confirmed = window.confirm(
      `¿Cerrar la sesión "${session.name}"? Los invitados verán "Esta sesión terminó" y ya no podrán agregar canciones.`
    );
    if (!confirmed) return;

    setClosingCode(session.code);
    setFeedback(null);

    try {
      const response = await fetch(`/api/sessions/${session.code}/close`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        session?: Session;
        error?: string;
      };

      if (!response.ok || !data.session) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo cerrar la sesión.",
        });
        return;
      }

      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id
            ? {
                ...item,
                is_active: false,
                closed_at: data.session!.closed_at,
              }
            : item
        )
      );
      setFeedback({
        type: "success",
        text: `La sesión "${session.name}" fue cerrada.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al cerrar la sesión.",
      });
    } finally {
      setClosingCode(null);
    }
  }

  async function handleCopyUrl(session: DashboardSession) {
    try {
      await navigator.clipboard.writeText(session.publicUrl);
      setCopiedCode(session.code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setFeedback({
        type: "error",
        text: "No se pudo copiar el enlace al portapapeles.",
      });
    }
  }

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-live/30 bg-live/10 text-live"
              : "border-ok/30 bg-ok/10 text-ok"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Crear nueva sesión */}
      <section
        aria-labelledby="new-session-heading"
        className="surface-card rounded-2xl p-6 sm:p-7"
      >
        <div className="flex items-center gap-2.5">
          <Mic2 className="h-5 w-5 text-stage" aria-hidden="true" />
          <h2 id="new-session-heading" className="text-lg font-semibold text-ink">
            Nueva sesión de karaoke
          </h2>
        </div>
        <p className="mt-1 text-sm text-ink-secondary">
          Crea una fiesta y obtén al instante el código QR y el enlace público
          para tus invitados.
        </p>

        <form
          onSubmit={handleCreateSession}
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="session-name-input" className="sr-only">
            Nombre de la sesión
          </label>
          <input
            id="session-name-input"
            type="text"
            maxLength={80}
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Cumpleaños de mamá, Noche de karaoke..."
            className="flex-1 rounded-xl border border-white/10 bg-canvas px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-stage px-6 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover disabled:opacity-60"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nueva sesión
              </>
            )}
          </button>
        </form>
      </section>

      {/* Sesiones activas */}
      <section aria-labelledby="active-sessions-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="active-sessions-heading"
            className="flex items-center gap-2 text-lg font-semibold text-ink"
          >
            <Radio className="h-4 w-4 text-ok" aria-hidden="true" />
            Sesiones activas ({activeSessions.length})
          </h2>
        </div>

        {activeSessions.length === 0 ? (
          <div className="surface-card rounded-2xl p-10 text-center">
            <p className="text-base font-medium text-ink">
              No tienes ninguna fiesta activa en este momento
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              Escribe un nombre arriba y pulsa{" "}
              <strong className="text-ink">Nueva sesión</strong> para generar tu
              código QR.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeSessions.map((session) => (
              <article
                key={session.id}
                className="surface-card flex flex-col justify-between rounded-2xl p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-ok/15 px-2.5 py-0.5 text-xs font-medium text-ok">
                        Activa
                      </span>
                      <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">
                        {session.name}
                      </h3>
                    </div>
                    <span className="rounded-lg border border-white/10 bg-canvas px-2.5 py-1 font-mono text-xs text-ink-secondary">
                      {session.code}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>
                      Creada el{" "}
                      {new Date(session.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>
                      {session.activeQueueCount}{" "}
                      {session.activeQueueCount === 1
                        ? "canción en cola"
                        : "canciones en cola"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-canvas/75 px-3 py-2 text-xs">
                    <span className="truncate font-mono text-ink-secondary">
                      {session.publicUrl.replace(/^https?:\/\//, "")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(session)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stage hover:bg-elevated"
                    >
                      {copiedCode === session.code ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <Link
                    href={`/host/${session.code}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-stage px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover"
                  >
                    <Tv className="h-4 w-4" aria-hidden="true" />
                    Pantalla TV
                  </Link>

                  <Link
                    href={`/remote/${session.code}`}
                    title="Controlar la TV desde tu celular"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-white/20 hover:bg-elevated"
                  >
                    <Smartphone
                      className="h-4 w-4 text-stage"
                      aria-hidden="true"
                    />
                    Control
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleOpenQr(session)}
                    disabled={loadingQrCode === session.code}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-white/20 hover:bg-elevated disabled:opacity-50"
                  >
                    {loadingQrCode === session.code ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <QrCode className="h-4 w-4 text-stage" aria-hidden="true" />
                    )}
                    QR
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCloseSession(session)}
                    disabled={closingCode === session.code}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-live/25 bg-live/10 px-3.5 py-2.5 text-sm font-medium text-live transition-colors hover:bg-live/20 disabled:opacity-50"
                  >
                    {closingCode === session.code ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <PowerOff className="h-4 w-4" aria-hidden="true" />
                    )}
                    Cerrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Playlists guardadas */}
      <PlaylistsSection
        initialPlaylists={initialPlaylists}
        activeSessions={activeSessions.map((s) => ({
          code: s.code,
          name: s.name,
        }))}
        onQueueLoaded={(sessionCode, addedCount) => {
          setSessions((prev) =>
            prev.map((item) =>
              item.code === sessionCode
                ? {
                    ...item,
                    activeQueueCount: item.activeQueueCount + addedCount,
                  }
                : item
            )
          );
        }}
      />

      {/* Historial de sesiones cerradas */}
      {closedSessions.length > 0 && (
        <section aria-labelledby="closed-sessions-heading" className="space-y-3">
          <h2
            id="closed-sessions-heading"
            className="text-base font-semibold text-ink-secondary"
          >
            Sesiones finalizadas ({closedSessions.length})
          </h2>

          <div className="surface-card divide-y divide-white/5 overflow-hidden rounded-2xl">
            {closedSessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
              >
                <div>
                  <p className="font-medium text-ink-secondary">
                    {session.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Código{" "}
                    <span className="font-mono text-ink-secondary">
                      {session.code}
                    </span>
                    {session.closed_at && (
                      <>
                        {" · "}Cerrada el{" "}
                        {new Date(session.closed_at).toLocaleDateString(
                          "es-ES",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </>
                    )}
                  </p>
                </div>

                <span className="rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-ink-muted">
                  Cerrada
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal de QR */}
      {qrModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setQrModal(null)}
        >
          <div
            className="surface-card relative w-full max-w-md rounded-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrModal(null)}
              aria-label="Cerrar ventana"
              className="absolute right-4 top-4 rounded-lg p-2 text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="mb-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-stage">
                Código {qrModal.code}
              </p>
              <h3
                id="qr-modal-title"
                className="mt-1 text-xl font-bold text-ink"
              >
                {qrModal.name}
              </h3>
            </div>

            <SessionQrCard
              code={qrModal.code}
              name={qrModal.name}
              initialPublicUrl={qrModal.publicUrl}
              initialQrDataUrl={qrModal.qrDataUrl}
            />

            <div className="mt-6 flex justify-center">
              <Link
                href={`/host/${qrModal.code}`}
                className="inline-flex items-center gap-2 rounded-xl bg-stage px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover"
              >
                <Tv className="h-4 w-4" aria-hidden="true" />
                Ir a la pantalla del anfitrión
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
