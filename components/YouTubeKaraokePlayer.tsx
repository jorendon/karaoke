"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Mic2, Volume2 } from "lucide-react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId?: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: {
              data: number;
              target: YTPlayerInstance;
            }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
  getPlayerState: () => number;
  getIframe: () => HTMLIFrameElement;
}

export interface YouTubeKaraokePlayerHandle {
  togglePlayPause: () => void;
  play: () => void;
  pause: () => void;
  requestFullscreen: () => void;
}

interface YouTubeKaraokePlayerProps {
  videoId: string | null;
  queueItemId: string | null;
  onEnded: (queueItemId: string) => void;
  onError: (queueItemId: string, errorCode: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

let ytApiLoadPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (ytApiLoadPromise) {
    return ytApiLoadPromise;
  }

  ytApiLoadPromise = new Promise<void>((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };

    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    } else {
      // Si el script ya estaba en el DOM, sondear brevemente hasta que YT.Player exista
      const poll = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
    }
  });

  return ytApiLoadPromise;
}

export const YouTubeKaraokePlayer = forwardRef<
  YouTubeKaraokePlayerHandle,
  YouTubeKaraokePlayerProps
>(function YouTubeKaraokePlayer(
  { videoId, queueItemId, onEnded, onError, onPlayStateChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const readyRef = useRef(false);
  const initializingRef = useRef(false);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const latestPropsRef = useRef({ videoId, queueItemId });
  const callbacksRef = useRef({ onEnded, onError, onPlayStateChange });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  latestPropsRef.current = { videoId, queueItemId };
  callbacksRef.current = { onEnded, onError, onPlayStateChange };

  useImperativeHandle(
    ref,
    () => ({
      play() {
        playerRef.current?.playVideo();
        setNeedsUserInteraction(false);
      },
      pause() {
        playerRef.current?.pauseVideo();
      },
      togglePlayPause() {
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        const state = player.getPlayerState();
        if (state === 1) {
          player.pauseVideo();
        } else {
          player.playVideo();
          setNeedsUserInteraction(false);
        }
      },
      requestFullscreen() {
        const target =
          playerRef.current?.getIframe?.() ?? containerRef.current;
        if (!target) return;
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else if (target.requestFullscreen) {
          void target.requestFullscreen();
        }
      },
    }),
    []
  );

  // Limpiar reproductor solo al desmontar el componente
  useEffect(() => {
    return () => {
      readyRef.current = false;
      initializingRef.current = false;
      lastLoadedKeyRef.current = null;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignorar errores al desmontar iframe
        }
        playerRef.current = null;
      }
    };
  }, []);

  // Crea el reproductor al recibir el primer videoId (siempre en contenedor visible)
  // y carga nuevos videos con loadVideoById cuando cambia la canción.
  useEffect(() => {
    let cancelled = false;
    let autoplayCheckTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleAutoplayCheck() {
      if (autoplayCheckTimer) clearTimeout(autoplayCheckTimer);
      autoplayCheckTimer = setTimeout(() => {
        if (cancelled || !playerRef.current || !readyRef.current) return;
        try {
          const state = playerRef.current.getPlayerState();
          // -1 (unstarted), 5 (cued) o 2 (paused) tras 2.5s indica bloqueo de autoplay
          if (state === -1 || state === 5 || state === 2) {
            setNeedsUserInteraction(true);
          }
        } catch {
          // Ignorar
        }
      }, 2500);
    }

    if (!videoId || !queueItemId) {
      lastLoadedKeyRef.current = null;
      setIsPlaying(false);
      setIsLoadingPlayer(false);
      setNeedsUserInteraction(false);
      if (playerRef.current && readyRef.current) {
        try {
          playerRef.current.stopVideo();
        } catch {
          // Ignorar
        }
      }
      return;
    }

    const loadKey = `${queueItemId}:${videoId}`;

    // Caso 1: El reproductor ya está listo -> cargar siguiente video
    if (playerRef.current && readyRef.current) {
      if (lastLoadedKeyRef.current !== loadKey) {
        lastLoadedKeyRef.current = loadKey;
        setNeedsUserInteraction(false);
        try {
          playerRef.current.loadVideoById(videoId);
          scheduleAutoplayCheck();
        } catch {
          // Ignorar
        }
      }
      return () => {
        if (autoplayCheckTimer) clearTimeout(autoplayCheckTimer);
      };
    }

    // Caso 2: Ya se está inicializando; onReady leerá latestPropsRef.current
    if (initializingRef.current) {
      return;
    }

    // Caso 3: Primera inicialización con un videoId real en contenedor visible
    initializingRef.current = true;
    setIsLoadingPlayer(true);

    async function createPlayer() {
      await loadYouTubeIframeApi();
      if (cancelled) return;
      if (!playerMountRef.current || !window.YT?.Player) {
        initializingRef.current = false;
        setIsLoadingPlayer(false);
        return;
      }

      const initialVideoId = latestPropsRef.current.videoId;
      const initialQueueItemId = latestPropsRef.current.queueItemId;
      if (!initialVideoId || !initialQueueItemId) {
        initializingRef.current = false;
        setIsLoadingPlayer(false);
        return;
      }

      const hostNode = document.createElement("div");
      hostNode.style.width = "100%";
      hostNode.style.height = "100%";
      playerMountRef.current.innerHTML = "";
      playerMountRef.current.appendChild(hostNode);

      lastLoadedKeyRef.current = `${initialQueueItemId}:${initialVideoId}`;

      const player = new window.YT.Player(hostNode, {
        width: "100%",
        height: "100%",
        videoId: initialVideoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          playsinline: 1,
          fs: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            initializingRef.current = false;
            readyRef.current = true;
            setIsLoadingPlayer(false);

            try {
              const iframe = event.target.getIframe();
              if (iframe) {
                iframe.style.width = "100%";
                iframe.style.height = "100%";
              }
            } catch {
              // Ignorar
            }

            const current = latestPropsRef.current;
            if (!current.videoId || !current.queueItemId) return;

            const currentKey = `${current.queueItemId}:${current.videoId}`;
            if (currentKey !== lastLoadedKeyRef.current) {
              lastLoadedKeyRef.current = currentKey;
              event.target.loadVideoById(current.videoId);
            } else {
              event.target.playVideo();
            }
            scheduleAutoplayCheck();
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === 1) {
              setIsPlaying(true);
              setIsLoadingPlayer(false);
              setNeedsUserInteraction(false);
              callbacksRef.current.onPlayStateChange?.(true);
            } else if (state === 2 || state === 5 || state === -1) {
              setIsPlaying(false);
              callbacksRef.current.onPlayStateChange?.(false);
            } else if (state === 0) {
              setIsPlaying(false);
              callbacksRef.current.onPlayStateChange?.(false);
              const finishedId = latestPropsRef.current.queueItemId;
              if (finishedId) {
                callbacksRef.current.onEnded(finishedId);
              }
            }
          },
          onError: (event) => {
            setIsPlaying(false);
            setIsLoadingPlayer(false);
            callbacksRef.current.onPlayStateChange?.(false);
            const failedId = latestPropsRef.current.queueItemId;
            if (failedId) {
              callbacksRef.current.onError(failedId, event.data);
            }
          },
        },
      });

      playerRef.current = player;
    }

    void createPlayer();

    return () => {
      cancelled = true;
      if (!playerRef.current) {
        initializingRef.current = false;
      }
      if (autoplayCheckTimer) clearTimeout(autoplayCheckTimer);
    };
  }, [videoId, queueItemId]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
    >
      {/* Contenedor siempre montado y visible para el iframe oficial de YouTube */}
      <div
        ref={playerMountRef}
        className={`h-full w-full transition-opacity ${
          videoId ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Indicador mientras carga la primera instancia del reproductor */}
      {videoId && isLoadingPlayer && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex items-center gap-2.5 rounded-xl bg-surface/90 px-4 py-2.5 text-sm font-medium text-ink">
            <Loader2 className="h-4 w-4 animate-spin text-stage" aria-hidden="true" />
            Cargando reproductor de YouTube...
          </div>
        </div>
      )}

      {/* Estado vacío superpuesto cuando no hay canción en reproducción */}
      {!videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-surface to-canvas p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stage/15 text-stage">
            <Mic2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="mt-4 text-xl font-bold text-ink sm:text-2xl">
            Listos para cantar
          </p>
          <p className="mt-2 max-w-md text-sm text-ink-secondary sm:text-base">
            Escanea el código QR con tu celular o agrega una canción desde el
            buscador del anfitrión para iniciar la música.
          </p>
        </div>
      )}

      {/* Aviso si el navegador bloqueó el autoplay inicial con sonido */}
      {videoId && needsUserInteraction && !isPlaying && !isLoadingPlayer && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
          <button
            type="button"
            onClick={() => {
              playerRef.current?.playVideo();
              setNeedsUserInteraction(false);
            }}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-stage px-5 py-2.5 text-sm font-bold text-canvas shadow-lg transition-transform hover:scale-105 hover:bg-stage-hover"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Toca aquí para iniciar el audio
          </button>
        </div>
      )}
    </div>
  );
});
