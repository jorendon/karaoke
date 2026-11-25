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
  Disc3,
  Expand,
  Flame,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PartyPopper,
  Pause,
  Play,
  Plus,
  PowerOff,
  QrCode,
  Radio,
  Search,
  Shuffle,
  SkipForward,
  Sparkles,
  User,
  X,
} from "lucide-react";
import type { QueueItem, Song } from "@/lib/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSessionQueueRealtime } from "@/hooks/useSessionQueueRealtime";
import {
  YouTubeKaraokePlayer,
  type YouTubeKaraokePlayerHandle,
} from "@/components/YouTubeKaraokePlayer";
import { SessionQrCard } from "@/components/SessionQrCard";
import { CatalogSearchWidget } from "@/components/CatalogSearchWidget";
import { SoundEqualizer } from "@/components/SoundEqualizer";
import { PartyBurst } from "@/components/PartyBurst";

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
  const [shuffling, setShuffling] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(true);
  const [showQrDrawer, setShowQrDrawer] = useState(true);
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [hostRequestName, setHostRequestName] = useState(hostDisplayName);
  const previousPlayingIdRef = useRef<string | null>(playingItem?.id ?? null);
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

  // Celebrar suavemente cada vez que arranca un nuevo cantante en el escenario
  useEffect(() => {
    const currentId = playingItem?.id ?? null;
    if (currentId && previousPlayingIdRef.current !== currentId) {
      if (previousPlayingIdRef.current !== null) {
        setBurstKey((prev) => prev + 1);
      }
    }
    previousPlayingIdRef.current = currentId;
  }, [playingItem?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Sincronizar estado de pantalla completa de la app completa
  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsAppFullscreen(
        Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
      );
    };

    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  const toggleAppFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen();
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
        } else {
          showToast(
            "info",
            "Este navegador no permite activar pantalla completa automáticamente."
          );
        }
      }
    } catch {
      showToast(
        "info",
        "No se pudo cambiar a pantalla completa en este navegador."
      );
    }
  }, [showToast]);

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

  // Escuchar comandos enviados desde el control remoto móvil (/remote/[code])
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`karaoke-remote-${sessionId}`)
      .on("broadcast", { event: "remote-command" }, ({ payload }) => {
        const command = (payload as { command?: string } | null)?.command;
        if (!command) return;

        if (command === "toggle-play") {
          playerRef.current?.togglePlayPause();
        } else if (command === "play") {
          playerRef.current?.play();
        } else if (command === "pause") {
          playerRef.current?.pause();
        } else if (command === "toggle-queue") {
          setShowQueueDrawer((prev) => !prev);
        } else if (command === "toggle-qr") {
          setShowQrDrawer((prev) => !prev);
        } else if (command === "cinema-mode") {
          setShowQueueDrawer(false);
          setShowQrDrawer(false);
        } else if (command === "show-panels") {
          setShowQueueDrawer(true);
          setShowQrDrawer(true);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Atajos de teclado y botones multimedia del control remoto Samsung TV (Tizen)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

      const key = event.key;
      const codeNum = event.keyCode;

      // Play / Pause (control Samsung TV: 415 Play, 19 Pause, 10252 PlayPause)
      if (
        key === "MediaPlayPause" ||
        key === "MediaPlay" ||
        key === "MediaPause" ||
        codeNum === 415 ||
        codeNum === 19 ||
        codeNum === 10252 ||
        (key === " " && !showSearchModal)
      ) {
        event.preventDefault();
        playerRef.current?.togglePlayPause();
        return;
      }

      // Siguiente canción (MediaTrackNext, MediaFastForward 417, tecla N)
      if (
        key === "MediaTrackNext" ||
        key === "MediaFastForward" ||
        codeNum === 417 ||
        key === "n" ||
        key === "N"
      ) {
        event.preventDefault();
        void advanceQueue("played");
        return;
      }

      if (key === "f" || key === "F") {
        event.preventDefault();
        void toggleAppFullscreen();
      } else if (key === "q" || key === "Q") {
        event.preventDefault();
        setShowQrDrawer((prev) => !prev);
      } else if (key === "c" || key === "C") {
        event.preventDefault();
        setShowQueueDrawer((prev) => !prev);
      } else if (key === "m" || key === "M") {
        event.preventDefault();
        setShowQueueDrawer((prevQ) => {
          const next = !(prevQ || showQrDrawer);
          setShowQrDrawer(next);
          return next;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceQueue, showQrDrawer, showSearchModal, toggleAppFullscreen]);

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

  async function handleShuffleQueue() {
    if (pendingItems.length <= 1 || shuffling) return;
    setShuffling(true);
    try {
      const response = await fetch(`/api/sessions/${code}/queue/shuffle`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        showToast("error", data.error || "No se pudo mezclar la cola.");
        return;
      }
      showToast("success", "Cola mezclada por turnos justos.");
      await refreshQueue();
    } catch {
      showToast("error", "Error de conexión al mezclar la cola.");
    } finally {
      setShuffling(false);
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
      <PartyBurst triggerKey={burstKey} />
      <div className="mx-auto max-w-[1720px]">
        {/* Barra superior */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="btn-party inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3.5 py-2 text-sm font-medium text-ink-secondary hover:border-white/20 hover:bg-elevated hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <PartyPopper className="h-5 w-5 text-stage" aria-hidden="true" />
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
              className={`btn-party inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
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
              className={`btn-party inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                showQrDrawer
                  ? "border-stage/40 bg-stage/15 text-stage"
                  : "border-white/10 bg-surface text-ink-secondary hover:border-white/20 hover:bg-elevated hover:text-ink"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              <span>QR</span>
              {showQrDrawer ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
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
                className="btn-party hidden items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:border-white/20 hover:bg-elevated hover:text-ink sm:inline-flex"
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
                className="btn-party hidden items-center gap-1.5 rounded-xl border border-stage/40 bg-stage/15 px-3 py-1.5 text-xs font-semibold text-stage hover:bg-stage/25 sm:inline-flex"
              >
                Mostrar paneles
              </button>
            )}

            <button
              type="button"
              onClick={() => void toggleAppFullscreen()}
              aria-pressed={isAppFullscreen}
              title={
                isAppFullscreen
                  ? "Salir de pantalla completa (mostrar barra del navegador)"
                  : "Ampliar app completa en la pantalla (oculta barra del navegador)"
              }
              className={`btn-party inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                isAppFullscreen
                  ? "border-stage/40 bg-stage/15 text-stage"
                  : "border-white/15 bg-elevated text-ink hover:border-stage/40 hover:bg-hover"
              }`}
            >
              {isAppFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Salir pantalla completa</span>
                </>
              ) : (
                <>
                  <Expand className="h-3.5 w-3.5 text-stage" aria-hidden="true" />
                  <span>Pantalla completa</span>
                </>
              )}
            </button>

            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                connected
                  ? "bg-ok/15 text-ok"
                  : "bg-elevated text-ink-secondary"
              }`}
            >
              <Radio
                className={`h-3.5 w-3.5 ${connected ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
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
            className={`animate-toast-in mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
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

        {/* Layout TV panorámico en 2 columnas: Izquierda (Cola + QR debajo) | Derecha (Reproductor gigante) */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* COLUMNA IZQUIERDA PLEGABLE — Cola arriba + QR debajo */}
          <div
            className={`order-2 flex-col gap-5 lg:order-1 lg:w-[350px] lg:shrink-0 xl:w-[380px] ${
              showQueueDrawer || showQrDrawer ? "flex" : "hidden"
            }`}
          >
            {/* DRAWER 1 — La cola */}
            <aside
              aria-label="Cola de canciones"
              className={`surface-card flex-col rounded-2xl p-5 ${
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
                  {pendingItems.length > 1 && (
                    <button
                      type="button"
                      disabled={shuffling}
                      onClick={() => {
                        setBurstKey((prev) => prev + 1);
                        void handleShuffleQueue();
                      }}
                      title="Mezclar turnos al azar (sin repetir cantante seguido)"
                      aria-label="Mezclar cola por turnos justos"
                      className="btn-party inline-flex items-center gap-1 rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:border-stage/40 hover:bg-elevated hover:text-ink disabled:opacity-40"
                    >
                      {shuffling ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Shuffle
                          className="h-3.5 w-3.5 text-stage"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => setShowSearchModal(true)}
                      className="btn-party inline-flex items-center gap-1 rounded-lg bg-stage px-3 py-1.5 text-xs font-bold text-canvas hover:bg-stage-hover"
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
                    className="btn-party rounded-lg border border-white/10 bg-surface p-1.5 text-ink-muted hover:bg-elevated hover:text-ink"
                  >
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Ahora suena */}
              <div className="mt-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-stage">
                  <SoundEqualizer active={Boolean(playingItem && isVideoPlaying)} size="sm" />
                  Ahora suena
                </p>
                {playingItem ? (
                  <div className="animate-queue-in mt-2 rounded-xl border border-stage/30 bg-stage/10 p-3.5">
                    <p className="line-clamp-2 text-base font-bold leading-snug text-ink">
                      {playingItem.title}
                    </p>
                    {playingItem.artist && (
                      <p className="mt-0.5 truncate text-sm text-ink-secondary">
                        {playingItem.artist}
                      </p>
                    )}
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-stage">
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
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
              <div
                className={`mt-5 overflow-y-auto pr-1 ${
                  showQrDrawer ? "max-h-[38vh]" : "max-h-[65vh]"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  Siguientes ({pendingItems.length})
                </p>

                {pendingItems.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-dashed border-white/10 bg-canvas/40 px-4 py-6 text-center text-sm text-ink-muted">
                    La fila está vacía 🎶 Pide una canción desde el QR o pulsa{" "}
                    <strong className="text-ink">+ Agregar</strong>.
                  </div>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {pendingItems.map((item, idx) => {
                      const isBusy = busyActionId === item.id;
                      const medal =
                        idx === 0
                          ? "🥇"
                          : idx === 1
                            ? "🥈"
                            : idx === 2
                              ? "🥉"
                              : null;

                      return (
                        <li
                          key={item.id}
                          className="animate-queue-in rounded-xl border border-white/10 bg-canvas/75 p-3 transition-colors hover:border-white/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-elevated font-mono text-xs font-bold text-stage">
                                {medal ?? idx + 1}
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
                              className="btn-party rounded-lg border border-white/10 bg-surface p-1.5 text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              disabled={isBusy || idx === pendingItems.length - 1}
                              onClick={() => handleItemAction(item.id, "down")}
                              title="Bajar en la cola"
                              aria-label={`Bajar ${item.title}`}
                              className="btn-party rounded-lg border border-white/10 bg-surface p-1.5 text-ink-secondary hover:bg-elevated hover:text-ink disabled:opacity-30"
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
                              className="btn-party rounded-lg border border-stage/30 bg-stage/10 p-1.5 text-stage hover:bg-stage/20 disabled:opacity-30"
                            >
                              <Play className="h-4 w-4" aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleItemAction(item.id, "remove")}
                              title="Eliminar de la cola"
                              aria-label={`Eliminar ${item.title}`}
                              className="btn-party rounded-lg border border-live/25 bg-live/10 p-1.5 text-live hover:bg-live/20 disabled:opacity-30"
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

            {/* DRAWER 2 (debajo de la cola) — Panel de la sesión + QR */}
            <aside
              aria-label="Panel de sesión y código QR"
              className={`surface-card flex-col justify-between gap-5 rounded-2xl p-5 ${
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
                      {totalInQueue} en cola
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowQrDrawer(false)}
                    title="Recoger panel QR"
                    aria-label="Recoger panel QR"
                    className="btn-party rounded-lg border border-white/10 bg-surface p-1.5 text-ink-muted hover:bg-elevated hover:text-ink"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4">
                  <SessionQrCard
                    code={code}
                    name={name}
                    initialPublicUrl={publicUrl}
                    initialQrDataUrl={qrDataUrl}
                    compact
                  />
                </div>
              </div>

              <div className="space-y-2.5 border-t border-white/10 pt-4">
                {isActive && (
                  <button
                    type="button"
                    onClick={() => setShowSearchModal(true)}
                    className="btn-party flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-white/20 hover:bg-elevated"
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
                    className="btn-party flex w-full items-center justify-center gap-2 rounded-xl border border-live/30 bg-live/10 px-4 py-2.5 text-sm font-semibold text-live hover:bg-live/20 disabled:opacity-50"
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
                  <div className="rounded-xl border border-live/30 bg-live/10 px-4 py-2.5 text-center text-sm font-semibold text-live">
                    Esta sesión terminó 🎤
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* COLUMNA DERECHA — Reproductor YouTube 16:9 a ancho máximo + Controles grandes */}
          <main
            className={`order-1 flex min-w-0 flex-1 flex-col gap-5 lg:order-2 ${
              !showQueueDrawer && !showQrDrawer ? "mx-auto w-full max-w-[1440px]" : ""
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

            {/* Info actual (cantante grande) + Aviso neón del próximo cantante + Controles TV */}
            <section className="surface-card rounded-2xl p-6">
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-stretch">
                  {/* Quién está cantando ahora */}
                  <div className="flex flex-col justify-center rounded-2xl border border-stage/25 bg-canvas/70 p-4 sm:p-5 xl:col-span-7">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-2 rounded-full bg-stage/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-stage">
                        {playingItem ? (
                          <Disc3
                            className={`h-4 w-4 ${isVideoPlaying ? "animate-spin-slow" : ""}`}
                            aria-hidden="true"
                          />
                        ) : (
                          <Mic2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {playingItem ? "Cantando ahora" : "En espera"}
                      </span>
                      {playingItem && (
                        <SoundEqualizer active={isVideoPlaying} size="md" />
                      )}
                    </div>

                    {playingItem ? (
                      <>
                        <p className="mt-2.5 flex items-center gap-2 text-2xl font-black tracking-tight text-stage sm:text-3xl lg:text-4xl">
                          <User
                            className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {playingItem.requested_by || "Invitado"}
                          </span>
                          <span aria-hidden="true" className="text-2xl">
                            🎤
                          </span>
                        </p>
                        <h1 className="mt-1.5 line-clamp-2 text-lg font-bold leading-snug text-ink sm:text-xl lg:text-2xl">
                          {playingItem.title}
                        </h1>
                        {playingItem.artist && (
                          <p className="mt-0.5 truncate text-sm text-ink-secondary sm:text-base">
                            {playingItem.artist}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                          {name}
                        </h1>
                        <p className="mt-1 text-sm text-ink-secondary sm:text-base">
                          Agrega canciones desde el QR para iniciar el
                          espectáculo 🎉
                        </p>
                      </>
                    )}
                  </div>

                  {/* Aviso de neón llamativo para el siguiente en cantar */}
                  {pendingItems[0] ? (
                    <div
                      aria-live="polite"
                      className="neon-next-box flex flex-col justify-center rounded-2xl p-4 sm:p-5 xl:col-span-5"
                    >
                      <p className="neon-next-label flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.18em]">
                        <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                        ¡Prepárate! Siguiente en cantar
                      </p>
                      <p className="neon-next-name mt-2 truncate text-2xl font-black uppercase tracking-wide sm:text-3xl lg:text-4xl">
                        ⚡ {pendingItems[0].requested_by || "Invitado"}
                      </p>
                      <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-cyan-100/90 sm:text-base">
                        🎵 {pendingItems[0].title}
                        {pendingItems[0].artist
                          ? ` — ${pendingItems[0].artist}`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center rounded-2xl border border-dashed border-white/15 bg-canvas/50 p-4 text-center sm:p-5 xl:col-span-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">
                        Siguiente turno libre ✨
                      </p>
                      <p className="mt-1.5 text-base font-semibold text-ink-secondary">
                        ¿Quién se anima a cantar después? 🎤
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Escanea el QR para pedir tu canción
                      </p>
                    </div>
                  )}
                </div>

                {/* Controles grandes legibles desde lejos */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={!playingItem}
                    onClick={() => playerRef.current?.togglePlayPause()}
                    className="btn-party flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-elevated px-5 py-4 text-base font-bold text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
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
                    className="btn-party flex items-center justify-center gap-2.5 rounded-2xl bg-stage px-5 py-4 text-base font-bold text-canvas hover:bg-stage-hover disabled:cursor-not-allowed disabled:opacity-40"
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
                    className="btn-party flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-elevated px-5 py-4 text-base font-bold text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Maximize2 className="h-5 w-5 text-stage" aria-hidden="true" />
                    Solo video
                  </button>
                </div>
              </div>
            </section>
          </main>
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
