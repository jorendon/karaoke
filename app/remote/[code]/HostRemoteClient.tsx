"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  PanelLeft,
  Play,
  PowerOff,
  QrCode,
  Radio,
  Search,
  SkipForward,
  Smartphone,
  Tv,
  X,
} from "lucide-react";
import type { QueueItem, Song } from "@/lib/database.types";
import { useSessionQueueRealtime } from "@/hooks/useSessionQueueRealtime";
import { CatalogSearchWidget } from "@/components/CatalogSearchWidget";
import { SessionQrCard } from "@/components/SessionQrCard";

interface HostRemoteClientProps {
  sessionId: string;
  code: string;
  name: string;
  initialIsActive: boolean;
  initialQueue: QueueItem[];
  publicUrl: string;
  qrDataUrl: string;
  hostDisplayName: string;
}

export function HostRemoteClient({
  sessionId,
  code,
  name,
  initialIsActive,
  initialQueue,
  publicUrl,
  qrDataUrl,
  hostDisplayName,
}: HostRemoteClientProps) {
  const { playingItem, pendingItems, isActive, setIsActive, connected, refreshQueue } =
    useSessionQueueRealtime({
      sessionId,
      sessionCode: code,
      initialItems: initialQueue,
      initialIsActive,
    });

  const [activeTab, setActiveTab] = useState<"controls" | "search" | "qr">(
    "controls"
  );
  const [sendingCmd, setSendingCmd] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function sendTvCommand(
    command:
      | "toggle-play"
      | "play"
      | "pause"
      | "toggle-queue"
      | "toggle-qr"
      | "cinema-mode"
      | "show-panels",
    successLabel: string
  ) {
    setSendingCmd(command);
    setFeedback(null);
    try {
      const response = await fetch(`/api/sessions/${code}/remote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setFeedback({
          type: "error",
          text: data.error || "No se pudo enviar el comando a la TV.",
        });
        return;
      }
      setFeedback({ type: "success", text: successLabel });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al enviar comando a la TV.",
      });
    } finally {
      setSendingCmd(null);
    }
  }

  async function handleNextSong() {
    setAdvancing(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/sessions/${code}/queue/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAs: "played" }),
      });
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: "No se pudo pasar a la siguiente canción.",
        });
        return;
      }
      setFeedback({ type: "success", text: "Siguiente canción enviada a la TV" });
      await refreshQueue();
    } finally {
      setAdvancing(false);
    }
  }

  async function handleItemAction(
    itemId: string,
    action: "up" | "down" | "remove" | "play-now"
  ) {
    setBusyItemId(itemId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/queue/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        setFeedback({ type: "error", text: "No se pudo actualizar la cola." });
        return;
      }
      await refreshQueue();
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleAddSong(
    song: Song
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch(`/api/sessions/${code}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeVideoId: song.youtube_video_id,
          title: song.title,
          artist: song.artist,
          requestedBy: hostDisplayName || "Anfitrión",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        queuePosition?: number;
        error?: string;
      };
      if (!response.ok) {
        return {
          ok: false,
          message: data.error || "No se pudo agregar la canción.",
        };
      }
      setFeedback({
        type: "success",
        text: `"${song.title}" agregada (#${data.queuePosition ?? 1})`,
      });
      await refreshQueue();
      return { ok: true };
    } catch {
      return { ok: false, message: "Error de conexión." };
    }
  }

  async function handleCloseSession() {
    const confirmed = window.confirm(
      `¿Cerrar la sesión "${name}"? Los invitados ya no podrán pedir canciones.`
    );
    if (!confirmed) return;

    setClosing(true);
    try {
      const response = await fetch(`/api/sessions/${code}/close`, {
        method: "POST",
      });
      if (response.ok) {
        setIsActive(false);
        setFeedback({ type: "success", text: "Sesión cerrada." });
      }
    } finally {
      setClosing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-10 pt-4 sm:px-6">
      {/* Encabezado compacto */}
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-elevated hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
              connected
                ? "bg-ok/15 text-ok"
                : "bg-elevated text-ink-secondary"
            }`}
          >
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            {connected ? "TV en vivo" : "Conectando..."}
          </span>

          <Link
            href={`/host/${code}`}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-elevated hover:text-ink"
          >
            <Tv className="h-3.5 w-3.5 text-stage" aria-hidden="true" />
            Modo TV
          </Link>
        </div>
      </header>

      {/* Identificador del control remoto */}
      <section className="surface-card mt-4 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-stage">
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          Control remoto del anfitrión · {code}
        </div>
        <h1 className="mt-1 text-xl font-bold text-ink">{name}</h1>

        {/* Ahora suena en la TV */}
        <div className="mt-4 rounded-xl border border-stage/25 bg-stage/10 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-stage">
            Sonando en la TV
          </p>
          {playingItem ? (
            <>
              <p className="mt-0.5 text-base font-bold text-ink">
                {playingItem.title}
              </p>
              <p className="text-xs text-ink-secondary">
                {playingItem.artist ? `${playingItem.artist} · ` : ""}🎤{" "}
                {playingItem.requested_by || "Invitado"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">
              No hay ninguna canción reproduciéndose ahora.
            </p>
          )}
        </div>

        {/* Botones principales de reproducción remota */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={!playingItem || sendingCmd !== null}
            onClick={() =>
              void sendTvCommand(
                "toggle-play",
                "Pausa / Reanudar enviado a la TV"
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-elevated px-4 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-hover disabled:opacity-40"
          >
            {sendingCmd === "toggle-play" ? (
              <Loader2 className="h-4 w-4 animate-spin text-stage" />
            ) : (
              <Play className="h-4 w-4 text-stage" aria-hidden="true" />
            )}
            Pausar / Play
          </button>

          <button
            type="button"
            disabled={advancing || (!playingItem && pendingItems.length === 0)}
            onClick={() => void handleNextSong()}
            className="flex items-center justify-center gap-2 rounded-xl bg-stage px-4 py-3.5 text-sm font-bold text-canvas transition-colors hover:bg-stage-hover disabled:opacity-40"
          >
            {advancing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            )}
            Siguiente
          </button>
        </div>

        {/* Controles rápidos de pantalla TV (drawers) */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={sendingCmd !== null}
            onClick={() =>
              void sendTvCommand("toggle-queue", "Panel de cola alternado en TV")
            }
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-canvas/70 px-2 py-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-40"
          >
            <PanelLeft className="h-4 w-4 text-stage" aria-hidden="true" />
            Cola TV
          </button>

          <button
            type="button"
            disabled={sendingCmd !== null}
            onClick={() =>
              void sendTvCommand("toggle-qr", "Panel QR alternado en TV")
            }
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-canvas/70 px-2 py-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-40"
          >
            <QrCode className="h-4 w-4 text-stage" aria-hidden="true" />
            QR TV
          </button>

          <button
            type="button"
            disabled={sendingCmd !== null}
            onClick={() =>
              void sendTvCommand("cinema-mode", "Video ampliado en la TV")
            }
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-canvas/70 px-2 py-2.5 text-[11px] font-semibold text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-40"
          >
            <Maximize2 className="h-4 w-4 text-stage" aria-hidden="true" />
            Ampliar TV
          </button>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
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

      {/* Pestañas: Cola / Agregar / QR */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-surface p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("controls")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === "controls"
              ? "bg-stage text-canvas"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <ListMusic className="h-4 w-4" aria-hidden="true" />
          Cola ({pendingItems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === "search"
              ? "bg-stage text-canvas"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Agregar
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qr")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            activeTab === "qr"
              ? "bg-stage text-canvas"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
          QR / Fiesta
        </button>
      </div>

      {/* Pestaña 1: Cola con controles de anfitrión */}
      {activeTab === "controls" && (
        <section className="surface-card mt-4 rounded-2xl p-4">
          {pendingItems.length === 0 ? (
            <div className="py-8 text-center">
              <Mic2
                className="mx-auto h-7 w-7 text-ink-muted"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-medium text-ink">
                No hay canciones en espera
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                Usa la pestaña Agregar o comparte el QR con los invitados.
              </p>
            </div>
          ) : (
            <ol className="space-y-2.5">
              {pendingItems.map((item, idx) => {
                const isBusy = busyItemId === item.id;
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-canvas/70 p-3.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-elevated font-mono text-xs font-bold text-stage">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-ink">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-secondary">
                          {item.artist ? `${item.artist} · ` : ""}🎤{" "}
                          {item.requested_by || "Invitado"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-white/5 pt-2">
                      <button
                        type="button"
                        disabled={isBusy || idx === 0}
                        onClick={() => handleItemAction(item.id, "up")}
                        aria-label={`Subir ${item.title}`}
                        className="rounded-lg border border-white/10 bg-surface p-2 text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || idx === pendingItems.length - 1}
                        onClick={() => handleItemAction(item.id, "down")}
                        aria-label={`Bajar ${item.title}`}
                        className="rounded-lg border border-white/10 bg-surface p-2 text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleItemAction(item.id, "play-now")}
                        aria-label={`Reproducir ahora ${item.title}`}
                        className="rounded-lg border border-stage/30 bg-stage/10 p-2 text-stage hover:bg-stage/20 disabled:opacity-30"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleItemAction(item.id, "remove")}
                        aria-label={`Eliminar ${item.title}`}
                        className="rounded-lg border border-live/25 bg-live/10 p-2 text-live hover:bg-live/20 disabled:opacity-30"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* Pestaña 2: Buscar y agregar */}
      {activeTab === "search" && (
        <section className="surface-card mt-4 rounded-2xl p-4">
          {isActive ? (
            <CatalogSearchWidget onAddSong={handleAddSong} compact />
          ) : (
            <p className="py-6 text-center text-sm text-live">
              Esta sesión ya está cerrada.
            </p>
          )}
        </section>
      )}

      {/* Pestaña 3: QR y cierre */}
      {activeTab === "qr" && (
        <section className="surface-card mt-4 space-y-6 rounded-2xl p-6">
          <SessionQrCard
            code={code}
            name={name}
            initialPublicUrl={publicUrl}
            initialQrDataUrl={qrDataUrl}
            compact
          />

          <div className="border-t border-white/10 pt-4">
            {isActive ? (
              <button
                type="button"
                onClick={handleCloseSession}
                disabled={closing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm font-semibold text-live hover:bg-live/20 disabled:opacity-50"
              >
                {closing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" aria-hidden="true" />
                )}
                Cerrar sesión
              </button>
            ) : (
              <p className="rounded-xl bg-live/10 py-3 text-center text-sm font-semibold text-live">
                Esta sesión terminó
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
