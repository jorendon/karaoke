"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Mic2, Volume2 } from "lucide-react";

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
  const lastLoadedKeyRef = useRef<string | null>(null);
  const activeItemIdRef = useRef<string | null>(queueItemId);
  const callbacksRef = useRef({ onEnded, onError, onPlayStateChange });

  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  activeItemIdRef.current = queueItemId;
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

  // Inicializa la instancia del reproductor de YouTube una sola vez
  useEffect(() => {
    let cancelled = false;

    async function initPlayer() {
      await loadYouTubeIframeApi();
      if (cancelled || !playerMountRef.current || !window.YT?.Player) return;

      // Crear un div hijo dedicado para que React no pierda el nodo al ser reemplazado por el iframe
      const hostNode = document.createElement("div");
      hostNode.className = "h-full w-full";
      playerMountRef.current.innerHTML = "";
      playerMountRef.current.appendChild(hostNode);

      const player = new window.YT.Player(hostNode, {
        width: "100%",
        height: "100%",
        videoId: videoId ?? undefined,
        playerVars: {
          autoplay: 1,
          rel: 0,
          playsinline: 1,
          fs: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            readyRef.current = true;
            if (videoId && queueItemId) {
              lastLoadedKeyRef.current = `${queueItemId}:${videoId}`;
              event.target.loadVideoById(videoId);
            }
          },
          onStateChange: (event) => {
            if (cancelled) return;
            const state = event.data;
            if (state === 1) {
              setIsPlaying(true);
              setNeedsUserInteraction(false);
              callbacksRef.current.onPlayStateChange?.(true);
            } else if (state === 2) {
              setIsPlaying(false);
              callbacksRef.current.onPlayStateChange?.(false);
            } else if (state === 5 || state === -1) {
              setIsPlaying(false);
              callbacksRef.current.onPlayStateChange?.(false);
            } else if (state === 0) {
              setIsPlaying(false);
              callbacksRef.current.onPlayStateChange?.(false);
              const finishedId = activeItemIdRef.current;
              if (finishedId) {
                callbacksRef.current.onEnded(finishedId);
              }
            }
          },
          onError: (event) => {
            if (cancelled) return;
            setIsPlaying(false);
            callbacksRef.current.onPlayStateChange?.(false);
            const failedId = activeItemIdRef.current;
            if (failedId) {
              callbacksRef.current.onError(failedId, event.data);
            }
          },
        },
      });

      playerRef.current = player;
    }

    void initPlayer();

    return () => {
      cancelled = true;
      readyRef.current = false;
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
    // Solo montamos el player una vez; los cambios de video se cargan con loadVideoById
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando cambia el item 'playing', cargar el nuevo video y reproducir
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    if (!videoId || !queueItemId) {
      lastLoadedKeyRef.current = null;
      try {
        player.stopVideo();
      } catch {
        // Ignorar
      }
      setIsPlaying(false);
      setNeedsUserInteraction(false);
      return;
    }

    const loadKey = `${queueItemId}:${videoId}`;
    if (lastLoadedKeyRef.current === loadKey) return;
    lastLoadedKeyRef.current = loadKey;

    try {
      player.loadVideoById(videoId);
      // Si el navegador bloquea autoplay con sonido en la primera canción, mostrar aviso suave
      const timer = setTimeout(() => {
        try {
          const state = playerRef.current?.getPlayerState();
          if (state === -1 || state === 5 || state === 2) {
            setNeedsUserInteraction(true);
          }
        } catch {
          // Ignorar
        }
      }, 2200);
      return () => clearTimeout(timer);
    } catch {
      // Ignorar
    }
  }, [videoId, queueItemId]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
    >
      {/* Contenedor del iframe oficial de YouTube */}
      <div
        ref={playerMountRef}
        className={`h-full w-full ${videoId ? "block" : "hidden"}`}
      />

      {/* Estado vacío cuando no hay canción en reproducción */}
      {!videoId && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-surface to-canvas p-8 text-center">
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

      {/* Aviso si el navegador requiere un clic inicial para audio/autoplay */}
      {videoId && needsUserInteraction && !isPlaying && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
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
