"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  PowerOff,
  QrCode,
  Radio,
  Search,
  SkipForward,
  User,
  X,
} from "lucide-react";
import type { QueueItem, Song } from "@/lib/database.types";
import { useSessionQueueRealtime } from "@/hooks/useSessionQueueRealtime";
import {
  YouTubeKaraokePlayer,
  type YouTubeKaraokePlayerHandle,
} from "@/components/YouTubeKaraokePlayer";
import { SessionQrCard } from "@/components/SessionQrCard";
import { CatalogSearchWidget } from "@/components/CatalogSearchWidget";

interface HostScreenClientProps {
  sessionId: string;
  code: string;
  name: string;
  initialIsActive: boolean;
  initialQueue: QueueItem[];
  publicUrl: string;
  qrDataUrl: string;
  hostDisplayName: string;
}

export function HostScreenClient({
  sessionId,
  code,
  name,
  initialIsActive,
  initialQueue,
  publicUrl,
  qrDataUrl,
  hostDisplayName,
}: HostScreenClientProps) {
  const {
    playingItem,
    pendingItems,
    historyItems,
    isActive,
    setIsActive,
    connected,
    refreshQueue,
  } = useSessionQueueRealtime({
    sessionId,
    sessionCode: code,
    initialItems: initialQueue,
    initialIsActive,
  });

  const playerRef = useRef<YouTubeKaraokePlayerHandle | null>(null);
  const advancingRef = useRef(false);
  const lastHandledItemRef = useRef<string | null>(null);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(true);
  const [showQrDrawer, setShowQrDrawer] = useState(true);
  const [hostRequestName, setHostRequestName] = useState(hostDisplayName);
  const [toast, setToast] = useState<{
    type: "info" | "error" | "success";
    text: string;
  } | null>(null);

  const showToast = useCallback(
    (type: "info" | "error" | "success", text: string) => {
      setToast({ type, text });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const advanceQueue = useCallback(
    async (markAs: "played" | "skipped" = "played", expectedItemId?: string) => {
      if (advancingRef.current) return;
      if (expectedItemId && lastHandledItemRef.current === expectedItemId) {
        return;
      }

      advancingRef.current = true;
      if (expectedItemId) {
        lastHandledItemRef.current = expectedItemId;
      }
      setAdvancing(true);

      try {
        const response = await fetch(`/api/sessions/${code}/queue/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAs }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          showToast("error", data.error || "No se pudo avanzar la cola.");
        }
        await refreshQueue();
      } catch {
        showToast("error", "Error de conexión al avanzar la cola.");
      } finally {
        advancingRef.current = false;
        setAdvancing(false);
      }
    },
    [code, refreshQueue, showToast]
  );

  // Al montar o al llegar una canción cuando no hay nada sonando, promover la primera 'pending'
  useEffect(() => {
    if (!isActive) return;
    if (!playingItem && pendingItems.length > 0 && !advancingRef.current) {
      void advanceQueue("played");
    }
  }, [isActive, playingItem, pendingItems.length, advanceQueue]);

  const handleVideoEnded = useCallback(
    (finishedItemId: string) => {
      void advanceQueue("played", finishedItemId);
    },
    [advanceQueue]
  );

  const handleVideoError = useCallback(
    (failedItemId: string, errorCode: number) => {
      showToast(
        "error",
        `El video falló en el reproductor (código ${errorCode}). Saltando automáticamente...`
      );
      void advanceQueue("skipped", failedItemId);
    },
    [advanceQueue, showToast]
  );

  async function handleItemAction(
    itemId: string,
    action: "up" | "down" | "remove" | "skip" | "play-now"
  ) {
    setBusyActionId(itemId);
    try {
      const response = await fetch(`/api/queue/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        showToast("error", data.error || "No se pudo actualizar la cola.");
        return;
      }

      if (action === "play-now") {
        lastHandledItemRef.current = null;
      }
      await refreshQueue();
    } catch {
      showToast("error", "Error de conexión al modificar la cola.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleHostAddSong(
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
          requestedBy: hostRequestName.trim() || hostDisplayName || "Anfitrión",
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
      showToast(
        "success",
        `"${song.title}" agregada a la cola (#${data.queuePosition ?? 1}).`
      );
      await refreshQueue();
      return { ok: true };
    } catch {
      return { ok: false, message: "Error de conexión al agregar la canción." };
    }
  }

  async function handleCloseSession() {
    const confirmed = window.confirm(
      `¿Cerrar la sesión "${name}"? Los invitados verán "Esta sesión terminó" y ya no podrán agregar canciones.`
    );
    if (!confirmed) return;

    setClosing(true);
    try {
      const response = await fetch(`/api/sessions/${code}/close`, {
        method: "POST",
      });
      if (response.ok) {
        setIsActive(false);
        showToast("info", "Sesión cerrada correctamente.");
      } else {
        showToast("error", "No se pudo cerrar la sesión.");
      }
    } finally {
      setClosing(false);
    }
  }

  const totalInQueue = pendingItems.length + (playingItem ? 1 : 0);

  return (
    <div className="min-h-dvh bg-canvas px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1720px]">
        {/* Barra superior */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3.5 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <Mic2 className="h-5 w-5 text-stage" aria-hidden="true" />
              <span className="text-lg font-bold tracking-tight text-ink">
                {name}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQueueDrawer((prev) => !prev)}
              aria-pressed={showQueueDrawer}
              title={showQueueDrawer ? "Recoger cola" : "Mostrar cola"}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showQueueDrawer
                  ? "border-stage/40 bg-stage/15 text-stage"
                  : "border-white/10 bg-surface text-ink-secondary hover:border-white/20 hover:bg-elevated hover:text-ink"
              }`}
            >
              {showQueueDrawer ? (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Cola ({pendingItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQrDrawer((prev) => !prev)}
              aria-pressed={showQrDrawer}
              title={showQrDrawer ? "Recoger QR" : "Mostrar QR"}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showQrDrawer
                  ? "border-stage/40 bg-stage/15 text-stage"
                  : "border-white/10 bg-surface text-ink-secondary hover:border-white/20 hover:bg-elevated hover:text-ink"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              <span>QR</span>
              {showQrDrawer ? (
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {(showQueueDrawer || showQrDrawer) ? (
              <button
                type="button"
                onClick={() => {
                  setShowQueueDrawer(false);
                  setShowQrDrawer(false);
                }}
                title="Recoger ambos paneles para ampliar el video"
                className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink sm:inline-flex"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                Ampliar video
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowQueueDrawer(true);
                  setShowQrDrawer(true);
                }}
                title="Mostrar cola y QR"
                className="hidden items-center gap-1.5 rounded-xl border border-stage/40 bg-stage/15 px-3 py-1.5 text-xs font-semibold text-stage transition-colors hover:bg-stage/25 sm:inline-flex"
              >
                Mostrar paneles
              </button>
            )}

            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                connected
                  ? "bg-ok/15 text-ok"
                  : "bg-elevated text-ink-secondary"
              }`}
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              {connected ? "En vivo" : "Conectando..."}
            </span>

            {!isActive && (
              <span className="rounded-xl bg-live/15 px-3 py-1.5 text-xs font-semibold text-live">
                Sesión cerrada
              </span>
            )}
          </div>
        </header>

        {/* Notificación flotante */}
        {toast && (
          <div
            role="status"
            className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
              toast.type === "error"
                ? "border-live/30 bg-live/15 text-live"
                : toast.type === "success"
                  ? "border-ok/30 bg-ok/15 text-ok"
                  : "border-stage/30 bg-stage/15 text-stage"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "error" ? (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{toast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Cerrar aviso"
              className="rounded p-1 hover:bg-black/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Layout TV / Escritorio con drawers plegables (sin desmontar el reproductor) */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* DRAWER IZQUIERDO — La cola */}
          <aside
            aria-label="Cola de canciones"
            className={`surface-card order-2 flex-col rounded-2xl p-5 lg:order-1 lg:max-h-[calc(100dvh-6.5rem)] lg:w-[340px] lg:shrink-0 xl:w-[370px] ${
              showQueueDrawer ? "flex" : "hidden"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2">
                <ListMusic className="h-5 w-5 text-stage" aria-hidden="true" />
                <h2 className="text-base font-bold uppercase tracking-wider text-ink">
                  Cola ({pendingItems.length})
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                {isActive && (
                  <button
                    type="button"
                    onClick={() => setShowSearchModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-stage px-3 py-1.5 text-xs font-bold text-canvas transition-colors hover:bg-stage-hover"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Agregar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowQueueDrawer(false)}
                  title="Recoger cola"
                  aria-label="Recoger panel de cola"
                  className="rounded-lg border border-white/10 bg-surface p-1.5 text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Ahora suena */}
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-stage">
                Ahora suena
              </p>
              {playingItem ? (
                <div className="mt-2 rounded-xl border border-stage/30 bg-stage/10 p-3.5">
                  <p className="line-clamp-2 text-base font-bold leading-snug text-ink">
                    {playingItem.title}
                  </p>
                  {playingItem.artist && (
                    <p className="mt-0.5 truncate text-sm text-ink-secondary">
                      {playingItem.artist}
                    </p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-stage">
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                    {playingItem.requested_by || "Invitado"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-canvas/60 px-3.5 py-3 text-sm text-ink-muted">
                  Sin canción en reproducción
                </p>
              )}
            </div>

            {/* Lista numerada de pendientes */}
            <div className="mt-5 flex-1 overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Siguientes ({pendingItems.length})
              </p>

              {pendingItems.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-white/10 bg-canvas/40 px-4 py-6 text-center text-sm text-ink-muted">
                  La fila está vacía. Pide una canción desde el QR o pulsa{" "}
                  <strong className="text-ink">+ Agregar</strong>.
                </div>
              ) : (
                <ol className="mt-2 space-y-2">
                  {pendingItems.map((item, idx) => {
                    const isBusy = busyActionId === item.id;
                    return (
                      <li
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-canvas/75 p-3 transition-colors hover:border-white/20"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-elevated font-mono text-xs font-bold text-stage">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                                {item.title}
                              </p>
                              {item.artist && (
                                <p className="truncate text-xs text-ink-secondary">
                                  {item.artist}
                                </p>
                              )}
                              <p className="mt-1 text-xs font-medium text-ink-muted">
                                🎤 {item.requested_by || "Invitado"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Controles del anfitrión ↑ ↓ ▶ ✕ */}
                        <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-white/5 pt-2">
                          <button
                            type="button"
                            disabled={isBusy || idx === 0}
                            onClick={() => handleItemAction(item.id, "up")}
                            title="Subir en la cola"
                            aria-label={`Subir ${item.title}`}
                            className="rounded-lg border border-white/10 bg-surface p-1.5 text-ink-secondary transition-colors hover:bg-elevated hover:text-ink disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || idx === pendingItems.length - 1}
                            onClick={() => handleItemAction(item.id, "down")}
                            title="Bajar en la cola"
                            aria-label={`Bajar ${item.title}`}
                            className="rounded-lg border border-white/10 bg-surface p-1.5 text-ink-secondary transition-colors hover:bg-elevated hover:text-ink disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleItemAction(item.id, "play-now")
                            }
                            title="Reproducir ahora"
                            aria-label={`Reproducir ahora ${item.title}`}
                            className="rounded-lg border border-stage/30 bg-stage/10 p-1.5 text-stage transition-colors hover:bg-stage/20 disabled:opacity-30"
                          >
                            <Play className="h-4 w-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleItemAction(item.id, "remove")}
                            title="Eliminar de la cola"
                            aria-label={`Eliminar ${item.title}`}
                            className="rounded-lg border border-live/25 bg-live/10 p-1.5 text-live transition-colors hover:bg-live/20 disabled:opacity-30"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* Sección colapsable "Ya sonaron" */}
              <div className="mt-5 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => setShowHistory((prev) => !prev)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-ink-muted hover:text-ink-secondary"
                >
                  <span>Ya sonaron ({historyItems.length})</span>
                  {showHistory ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {showHistory && (
                  <ul className="mt-2.5 space-y-1.5">
                    {historyItems.length === 0 ? (
                      <li className="text-xs text-ink-muted">
                        Todavía no ha terminado ninguna canción.
                      </li>
                    ) : (
                      historyItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-canvas/50 px-3 py-2 text-xs text-ink-muted"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-secondary">
                              {item.title}
                            </p>
                            <p className="truncate">
                              {item.requested_by || "Invitado"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 text-[10px]">
                            {item.status === "skipped" ? "Saltada" : "Sonó"}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
          </aside>

          {/* COLUMNA CENTRAL — Reproductor YouTube 16:9 + Controles grandes */}
          <main
            className={`order-1 flex min-w-0 flex-1 flex-col gap-5 lg:order-2 ${
              !showQueueDrawer && !showQrDrawer ? "mx-auto w-full max-w-[1380px]" : ""
            }`}
          >
            <YouTubeKaraokePlayer
              ref={playerRef}
              videoId={playingItem?.youtube_video_id ?? null}
              queueItemId={playingItem?.id ?? null}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              onPlayStateChange={setIsVideoPlaying}
            />

            {/* Info actual + Botones grandes de TV */}
            <section className="surface-card rounded-2xl p-6">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-stage">
                    {playingItem ? "Cantando ahora" : "En espera"}
                  </p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl lg:text-4xl">
                    {playingItem ? playingItem.title : name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-ink-secondary sm:text-lg">
                    {playingItem?.artist && <span>{playingItem.artist}</span>}
                    {playingItem && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-stage">
                        <User className="h-4 w-4" aria-hidden="true" />
                        Pedida por {playingItem.requested_by || "Invitado"}
                      </span>
                    )}
                    {!playingItem && (
                      <span>
                        Agrega canciones desde el QR para iniciar el espectáculo
                      </span>
                    )}
                  </div>
                </div>

                {/* Controles grandes legibles desde lejos */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={!playingItem}
                    onClick={() => playerRef.current?.togglePlayPause()}
                    className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-elevated px-5 py-4 text-base font-bold text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isVideoPlaying ? (
                      <>
                        <Pause className="h-5 w-5 text-stage" aria-hidden="true" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 text-stage" aria-hidden="true" />
                        Reanudar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={
                      advancing || (!playingItem && pendingItems.length === 0)
                    }
                    onClick={() => void advanceQueue("played")}
                    className="flex items-center justify-center gap-2.5 rounded-2xl bg-stage px-5 py-4 text-base font-bold text-canvas transition-colors hover:bg-stage-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {advancing ? (
                      <Loader2
                        className="h-5 w-5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <SkipForward className="h-5 w-5" aria-hidden="true" />
                    )}
                    Siguiente
                  </button>

                  <button
                    type="button"
                    disabled={!playingItem}
                    onClick={() => playerRef.current?.requestFullscreen()}
                    className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-elevated px-5 py-4 text-base font-bold text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Maximize2 className="h-5 w-5 text-stage" aria-hidden="true" />
                    Pantalla completa
                  </button>
                </div>
              </div>
            </section>
          </main>

          {/* DRAWER DERECHO — Panel de la sesión + QR */}
          <aside
            aria-label="Panel de sesión y código QR"
            className={`surface-card order-3 flex-col justify-between gap-6 rounded-2xl p-6 lg:w-[320px] lg:shrink-0 xl:w-[350px] ${
              showQrDrawer ? "flex" : "hidden"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-white/10 bg-canvas px-2.5 py-1 font-mono text-xs font-semibold text-stage">
                    {code}
                  </span>
                  <span className="rounded-lg bg-elevated px-2.5 py-1 text-xs font-semibold text-ink-secondary">
                    {totalInQueue}{" "}
                    {totalInQueue === 1 ? "en cola" : "en cola"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQrDrawer(false)}
                  title="Recoger panel QR"
                  aria-label="Recoger panel QR"
                  className="rounded-lg border border-white/10 bg-surface p-1.5 text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">
                {name}
              </h2>

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

            <div className="space-y-3 border-t border-white/10 pt-5">
              {isActive && (
                <button
                  type="button"
                  onClick={() => setShowSearchModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-white/20 hover:bg-elevated"
                >
                  <Search className="h-4 w-4 text-stage" aria-hidden="true" />
                  Buscar y agregar canción
                </button>
              )}

              {isActive ? (
                <button
                  type="button"
                  onClick={handleCloseSession}
                  disabled={closing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm font-semibold text-live transition-colors hover:bg-live/20 disabled:opacity-50"
                >
                  {closing ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Cerrando...
                    </>
                  ) : (
                    <>
                      <PowerOff className="h-4 w-4" aria-hidden="true" />
                      Cerrar sesión
                    </>
                  )}
                </button>
              ) : (
                <div className="rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-center text-sm font-semibold text-live">
                  Esta sesión terminó
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Modal para que el anfitrión busque y agregue canciones desde /host/[code] */}
      {showSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="host-search-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="surface-card relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSearchModal(false)}
              aria-label="Cerrar buscador"
              className="absolute right-4 top-4 rounded-lg p-2 text-ink-muted hover:bg-elevated hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2
              id="host-search-modal-title"
              className="text-xl font-bold text-ink"
            >
              Agregar canción a la cola
            </h2>

            <div className="mt-3 mb-4 flex items-center gap-3">
              <label
                htmlFor="host-requested-by"
                className="shrink-0 text-xs font-medium uppercase tracking-wider text-ink-secondary"
              >
                ¿Quién canta?
              </label>
              <input
                id="host-requested-by"
                type="text"
                maxLength={30}
                value={hostRequestName}
                onChange={(e) => setHostRequestName(e.target.value)}
                placeholder="Anfitrión"
                className="w-full max-w-xs rounded-lg border border-white/10 bg-canvas px-3 py-1.5 text-sm text-ink focus:border-stage focus:outline-none"
              />
            </div>

            <div className="overflow-y-auto pr-1">
              <CatalogSearchWidget onAddSong={handleHostAddSong} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
