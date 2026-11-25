"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Disc3,
  ListMusic,
  PartyPopper,
  Radio,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import type { QueueItem, Song } from "@/lib/database.types";
import { useSessionQueueRealtime } from "@/hooks/useSessionQueueRealtime";
import { CatalogSearchWidget } from "@/components/CatalogSearchWidget";
import { SoundEqualizer } from "@/components/SoundEqualizer";
import { PartyBurst } from "@/components/PartyBurst";

const GUEST_NAME_STORAGE_KEY = "karaoke_guest_name";

interface GuestScreenClientProps {
  sessionId: string;
  code: string;
  name: string;
  initialIsActive: boolean;
  initialQueue: QueueItem[];
  initialSongs: Song[];
  initialArtists: string[];
  initialGenres: string[];
}

export function GuestScreenClient({
  sessionId,
  code,
  name,
  initialIsActive,
  initialQueue,
  initialSongs,
  initialArtists,
  initialGenres,
}: GuestScreenClientProps) {
  const { playingItem, pendingItems, isActive, connected, refreshQueue } =
    useSessionQueueRealtime({
      sessionId,
      sessionCode: code,
      initialItems: initialQueue,
      initialIsActive,
    });

  const [guestName, setGuestName] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "queue">("search");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GUEST_NAME_STORAGE_KEY);
      if (saved) setGuestName(saved.slice(0, 30));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, []);

  function handleNameChange(value: string) {
    const clean = value.slice(0, 30);
    setGuestName(clean);
    try {
      window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, clean);
    } catch {
      // Ignorar
    }
  }

  const trimmedName = guestName.trim();
  const normalizedGuestName = trimmedName.toLowerCase();

  function isOwnSong(requestedBy: string | null): boolean {
    if (!normalizedGuestName || !requestedBy) return false;
    return requestedBy.trim().toLowerCase() === normalizedGuestName;
  }

  async function handleAddSong(
    song: Song
  ): Promise<{ ok: boolean; message?: string }> {
    if (!trimmedName) {
      return {
        ok: false,
        message: "Escribe tu nombre arriba antes de agregar una canción.",
      };
    }

    setConfirmation(null);
    try {
      const response = await fetch(`/api/sessions/${code}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeVideoId: song.youtube_video_id,
          title: song.title,
          artist: song.artist,
          requestedBy: trimmedName,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        queuePosition?: number;
        error?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          message: data.error || "No se pudo agregar la canción a la cola.",
        };
      }

      const pos = data.queuePosition ?? pendingItems.length + 1;
      setBurstKey((prev) => prev + 1);
      setConfirmation(`🎉 ¡Agregada! Eres el #${pos} en la fila`);
      void refreshQueue();
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "Error de conexión. Intenta de nuevo.",
      };
    }
  }

  // Si la sesión terminó (al abrir o en vivo por Realtime), ocultar buscador
  if (!isActive) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <div className="surface-card animate-toast-in w-full rounded-2xl p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stage/15 text-stage">
            <Sparkles className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            {name}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            Esta sesión terminó 🎤
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            ¡Gracias por cantar y aplaudir! El anfitrión cerró esta fiesta y ya
            no se pueden agregar canciones.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-10 pt-5 sm:px-6">
      <PartyBurst triggerKey={burstKey} />

      {/* Encabezado de la fiesta */}
      <header className="surface-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok">
            <Radio
              className={`h-3 w-3 ${connected ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            {connected ? "En vivo" : "Conectando..."}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted">
            <PartyPopper className="h-3.5 w-3.5 text-stage" aria-hidden="true" />
            #{code}
          </span>
        </div>

        <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-ink">
          {name} 🎤
        </h1>

        {/* Campo obligatorio del nombre del invitado (localStorage) */}
        <div className="mt-4">
          <label
            htmlFor="guest-name-input"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary"
          >
            <User className="h-3.5 w-3.5 text-stage" aria-hidden="true" />
            Tu nombre para la fila *
          </label>
          <input
            id="guest-name-input"
            type="text"
            maxLength={30}
            value={guestName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ej. Carlos, Ana..."
            className={`mt-1.5 block w-full rounded-xl border bg-canvas px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 ${
              trimmedName
                ? "border-white/15 focus:border-stage focus:ring-stage/30"
                : "border-stage/50 focus:border-stage focus:ring-stage/40"
            }`}
          />
          {!trimmedName && (
            <p className="mt-1.5 text-xs text-stage">
              ✨ Escribe tu nombre para poder pedir canciones.
            </p>
          )}
        </div>
      </header>

      {/* Banner compacto "Ahora suena" */}
      {playingItem && (
        <section
          aria-label="Ahora suena"
          className="animate-queue-in mt-4 flex items-center gap-3 rounded-2xl border border-stage/25 bg-stage/10 px-4 py-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stage/20 text-stage">
            <Disc3 className="animate-spin-slow h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-stage">
              <span>Ahora suena</span>
              <SoundEqualizer active size="sm" />
            </p>
            <p className="truncate text-sm font-bold text-ink">
              {playingItem.title}
            </p>
            <p className="truncate text-xs text-ink-secondary">
              {playingItem.artist ? `${playingItem.artist} · ` : ""}
              🎤 {playingItem.requested_by || "Invitado"}
            </p>
          </div>
        </section>
      )}

      {/* Confirmación visible al agregar */}
      {confirmation && (
        <div
          role="status"
          className="animate-toast-in mt-4 flex items-center gap-2.5 rounded-2xl border border-ok/30 bg-ok/15 px-4 py-3.5 text-sm font-semibold text-ok"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{confirmation}</span>
        </div>
      )}

      {/* Selector móvil: Pedir canción / Ver cola */}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-surface p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`btn-party flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${
            activeTab === "search"
              ? "bg-stage text-canvas"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Pedir canción
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`btn-party flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${
            activeTab === "queue"
              ? "bg-stage text-canvas"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <ListMusic className="h-4 w-4" aria-hidden="true" />
          Cola en vivo ({pendingItems.length})
        </button>
      </div>

      {/* Pestaña 1: Buscador del catálogo */}
      {activeTab === "search" && (
        <section
          aria-label="Buscador de canciones"
          className="surface-card mt-4 rounded-2xl p-4 sm:p-5"
        >
          <CatalogSearchWidget
            initialSongs={initialSongs}
            initialArtists={initialArtists}
            initialGenres={initialGenres}
            onAddSong={handleAddSong}
            disabledReason={
              trimmedName
                ? null
                : "Escribe tu nombre arriba para agregar canciones."
            }
          />
        </section>
      )}

      {/* Pestaña 2: Cola actual en modo lectura (Realtime) */}
      {activeTab === "queue" && (
        <section
          aria-label="Cola de reproducción"
          className="surface-card mt-4 space-y-5 rounded-2xl p-5"
        >
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stage">
              <SoundEqualizer active={Boolean(playingItem)} size="sm" />
              Ahora suena
            </h2>
            {playingItem ? (
              <div
                className={`animate-queue-in mt-2 rounded-xl border p-4 ${
                  isOwnSong(playingItem.requested_by)
                    ? "border-stage/50 bg-stage/15"
                    : "border-white/10 bg-canvas/70"
                }`}
              >
                <p className="text-base font-bold text-ink">
                  {playingItem.title}
                </p>
                {playingItem.artist && (
                  <p className="mt-0.5 text-sm text-ink-secondary">
                    {playingItem.artist}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="font-semibold text-stage">
                    🎤 {playingItem.requested_by || "Invitado"}
                  </span>
                  {isOwnSong(playingItem.requested_by) && (
                    <span className="rounded bg-stage px-1.5 py-0.5 text-[10px] font-bold text-canvas">
                      ⭐ ¡Te toca!
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-canvas/60 px-4 py-3 text-sm text-ink-muted">
                Aún no suena ninguna canción.
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">
              En espera ({pendingItems.length})
            </h2>

            {pendingItems.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-white/10 bg-canvas/40 px-4 py-8 text-center text-sm text-ink-muted">
                No hay canciones en espera 🎶 ¡Sé el primero en pedir una!
              </p>
            ) : (
              <ol className="mt-2.5 space-y-2">
                {pendingItems.map((item, idx) => {
                  const mine = isOwnSong(item.requested_by);
                  const medal =
                    idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                  return (
                    <li
                      key={item.id}
                      className={`animate-queue-in flex items-start gap-3 rounded-xl border p-3.5 ${
                        mine
                          ? "border-stage/40 bg-stage/10"
                          : "border-white/10 bg-canvas/70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                          mine
                            ? "bg-stage text-canvas"
                            : "bg-elevated text-ink-secondary"
                        }`}
                      >
                        {medal ?? idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-ink">
                          {item.title}
                        </p>
                        {item.artist && (
                          <p className="truncate text-xs text-ink-secondary">
                            {item.artist}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span
                            className={
                              mine
                                ? "font-bold text-stage"
                                : "text-ink-muted"
                            }
                          >
                            🎤 {item.requested_by || "Invitado"}
                          </span>
                          {mine && (
                            <span className="rounded bg-stage/20 px-1.5 py-0.5 text-[10px] font-semibold text-stage">
                              ⭐ Tuya
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
