"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListMusic,
  Loader2,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Playlist, PlaylistItem, Song } from "@/lib/database.types";

export interface SavedPlaylist extends Playlist {
  items: PlaylistItem[];
}

interface ActiveSessionOption {
  code: string;
  name: string;
}

interface PlaylistsSectionProps {
  initialPlaylists: SavedPlaylist[];
  activeSessions: ActiveSessionOption[];
  onQueueLoaded?: (sessionCode: string, addedCount: number) => void;
}

export function PlaylistsSection({
  initialPlaylists,
  activeSessions,
  onQueueLoaded,
}: PlaylistsSectionProps) {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(initialPlaylists);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSessionByPlaylist, setSelectedSessionByPlaylist] = useState<
    Record<string, string>
  >({});
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(
    null
  );
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(
    null
  );

  // Buscador rápido dentro de la playlist expandida
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function handleCreatePlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;

    setCreating(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        playlist?: SavedPlaylist;
        error?: string;
      };
      if (!response.ok || !data.playlist) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo crear la playlist.",
        });
        return;
      }
      setPlaylists((prev) => [data.playlist!, ...prev]);
      setNewPlaylistName("");
      setExpandedId(data.playlist.id);
      setFeedback({
        type: "success",
        text: `Playlist "${data.playlist.name}" creada.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al crear la playlist.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeletePlaylist(playlist: SavedPlaylist) {
    const confirmed = window.confirm(
      `¿Eliminar la playlist "${playlist.name}"?`
    );
    if (!confirmed) return;

    setDeletingPlaylistId(playlist.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setFeedback({
          type: "error",
          text: data.error || "No se pudo eliminar la playlist.",
        });
        return;
      }
      setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
      if (expandedId === playlist.id) setExpandedId(null);
    } finally {
      setDeletingPlaylistId(null);
    }
  }

  async function handleSearchSongs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({
        limit: "12",
        includeFilters: "0",
      });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const response = await fetch(`/api/songs/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        songs?: Song[];
        error?: string;
      };
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo buscar en el catálogo.",
        });
        return;
      }
      setSearchResults(data.songs ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSongToPlaylist(playlistId: string, song: Song) {
    setAddingSongId(song.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: song.id,
          youtubeVideoId: song.youtube_video_id,
          title: song.title,
          artist: song.artist,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        item?: PlaylistItem;
        error?: string;
      };
      if (!response.ok || !data.item) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo agregar la canción.",
        });
        return;
      }
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId ? { ...p, items: [...p.items, data.item!] } : p
        )
      );
    } finally {
      setAddingSongId(null);
    }
  }

  async function handleRemoveItem(playlistId: string, itemId: string) {
    setFeedback(null);
    const response = await fetch(
      `/api/playlists/${playlistId}/items?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      setFeedback({
        type: "error",
        text: "No se pudo quitar la canción de la playlist.",
      });
      return;
    }
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? { ...p, items: p.items.filter((i) => i.id !== itemId) }
          : p
      )
    );
  }

  async function handleLoadToSession(playlist: SavedPlaylist) {
    const targetCode =
      selectedSessionByPlaylist[playlist.id] || activeSessions[0]?.code || "";
    if (!targetCode) {
      setFeedback({
        type: "error",
        text: "Crea o selecciona una sesión activa primero.",
      });
      return;
    }

    setLoadingPlaylistId(playlist.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/playlists/${playlist.id}/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode: targetCode }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        addedCount?: number;
        skippedCount?: number;
        sessionName?: string;
        error?: string;
      };
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo cargar la playlist a la sesión.",
        });
        return;
      }
      const skippedNote =
        data.skippedCount && data.skippedCount > 0
          ? ` (${data.skippedCount} omitida(s) por estar bloqueadas)`
          : "";
      setFeedback({
        type: "success",
        text: `¡Listo! Se agregaron ${data.addedCount} canciones de "${playlist.name}" a "${data.sessionName}"${skippedNote}.`,
      });
      if (data.addedCount && onQueueLoaded) {
        onQueueLoaded(targetCode, data.addedCount);
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al cargar la playlist.",
      });
    } finally {
      setLoadingPlaylistId(null);
    }
  }

  return (
    <section
      aria-labelledby="playlists-heading"
      className="surface-card rounded-2xl p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <ListMusic className="h-5 w-5 text-stage" aria-hidden="true" />
          <h2 id="playlists-heading" className="text-lg font-semibold text-ink">
            Playlists guardadas ({playlists.length})
          </h2>
        </div>
        <span className="text-xs text-ink-muted">
          Prepara tus listas y cárgalas en 1 clic a cualquier sesión activa
        </span>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
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

      {/* Crear playlist */}
      <form
        onSubmit={handleCreatePlaylist}
        className="mt-4 flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="new-playlist-name" className="sr-only">
          Nombre de la nueva playlist
        </label>
        <input
          id="new-playlist-name"
          type="text"
          maxLength={80}
          required
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="Ej. Clásicos de los 80s, Salsa para arrancar..."
          className="flex-1 rounded-xl border border-white/10 bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-elevated px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-hover disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4 text-stage" aria-hidden="true" />
          )}
          Crear playlist
        </button>
      </form>

      {/* Lista de playlists */}
      {playlists.length === 0 ? (
        <p className="mt-5 text-center text-sm text-ink-muted">
          Aún no tienes playlists guardadas. Crea una arriba para tener tus
          canciones favoritas listas antes de cada fiesta.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {playlists.map((playlist) => {
            const isExpanded = expandedId === playlist.id;
            const selectedCode =
              selectedSessionByPlaylist[playlist.id] ||
              activeSessions[0]?.code ||
              "";

            return (
              <div
                key={playlist.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-canvas/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : playlist.id);
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-2.5 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp
                        className="h-4 w-4 text-stage"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="h-4 w-4 text-ink-muted"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {playlist.name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {playlist.items.length}{" "}
                        {playlist.items.length === 1 ? "canción" : "canciones"}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeSessions.length > 0 && playlist.items.length > 0 && (
                      <>
                        <select
                          aria-label={`Sesión destino para ${playlist.name}`}
                          value={selectedCode}
                          onChange={(e) =>
                            setSelectedSessionByPlaylist((prev) => ({
                              ...prev,
                              [playlist.id]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-stage focus:outline-none"
                        >
                          {activeSessions.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleLoadToSession(playlist)}
                          disabled={loadingPlaylistId === playlist.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-stage px-3 py-1.5 text-xs font-semibold text-canvas transition-colors hover:bg-stage-hover disabled:opacity-50"
                        >
                          {loadingPlaylistId === playlist.id ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Cargar a sesión
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeletePlaylist(playlist)}
                      disabled={deletingPlaylistId === playlist.id}
                      aria-label={`Eliminar playlist ${playlist.name}`}
                      className="rounded-lg border border-live/20 bg-live/10 p-1.5 text-live transition-colors hover:bg-live/20 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-4 border-t border-white/10 bg-surface/50 p-4">
                    {/* Canciones actuales de la playlist */}
                    {playlist.items.length === 0 ? (
                      <p className="text-xs text-ink-muted">
                        Lista vacía. Busca canciones abajo para agregarlas.
                      </p>
                    ) : (
                      <ol className="divide-y divide-white/5 rounded-lg border border-white/10 bg-canvas/70">
                        {playlist.items.map((item, idx) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="mr-2 font-mono text-ink-muted">
                                {idx + 1}.
                              </span>
                              <span className="font-medium text-ink">
                                {item.title}
                              </span>
                              {item.artist && (
                                <span className="ml-1.5 text-ink-secondary">
                                  — {item.artist}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveItem(playlist.id, item.id)
                              }
                              aria-label={`Quitar ${item.title}`}
                              className="rounded p-1 text-ink-muted hover:bg-elevated hover:text-live"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}

                    {/* Buscador para añadir canciones a esta playlist */}
                    <form
                      onSubmit={handleSearchSongs}
                      className="flex gap-2"
                    >
                      <div className="relative flex-1">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar canción en catálogo para agregar..."
                          className="block w-full rounded-lg border border-white/10 bg-canvas py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={searching}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-elevated px-3.5 py-2 text-xs font-semibold text-ink hover:bg-hover disabled:opacity-50"
                      >
                        {searching ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          "Buscar"
                        )}
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <ul className="max-h-56 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-canvas/80">
                        {searchResults.map((song) => (
                          <li
                            key={song.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {song.title}
                              </p>
                              <p className="truncate text-ink-muted">
                                {song.artist || song.channel_title || "Karaoke"}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={addingSongId === song.id}
                              onClick={() =>
                                handleAddSongToPlaylist(playlist.id, song)
                              }
                              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-stage/15 px-2.5 py-1 text-xs font-semibold text-stage hover:bg-stage/25 disabled:opacity-50"
                            >
                              {addingSongId === song.id ? (
                                <Loader2
                                  className="h-3 w-3 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Plus className="h-3 w-3" aria-hidden="true" />
                              )}
                              Añadir
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
