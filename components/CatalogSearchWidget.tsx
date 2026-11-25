"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Music,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { Song } from "@/lib/database.types";

interface CatalogSearchWidgetProps {
  initialSongs?: Song[];
  initialArtists?: string[];
  initialGenres?: string[];
  onAddSong: (song: Song) => Promise<{ ok: boolean; message?: string }>;
  disabledReason?: string | null;
  compact?: boolean;
}

export function CatalogSearchWidget({
  initialSongs = [],
  initialArtists = [],
  initialGenres = [],
  onAddSong,
  disabledReason = null,
  compact = false,
}: CatalogSearchWidgetProps) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [artists, setArtists] = useState<string[]>(initialArtists);
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [q, setQ] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(initialSongs.length === 0);
  const [youtubeUsed, setYoutubeUsed] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function fetchSongs(nextQ: string, nextArtist: string, nextGenre: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "30",
        includeFilters: "1",
      });
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextArtist) params.set("artist", nextArtist);
      if (nextGenre) params.set("genre", nextGenre);

      const response = await fetch(`/api/songs/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        songs?: Song[];
        youtubeFallbackUsed?: boolean;
        filters?: { artists: string[]; genres: string[] };
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || "No se pudo buscar en el catálogo.");
        return;
      }

      setSongs(data.songs ?? []);
      setYoutubeUsed(Boolean(data.youtubeFallbackUsed));
      if (data.filters) {
        setArtists(data.filters.artists);
        setGenres(data.filters.genres);
      }
    } catch {
      setError("Error de conexión al buscar canciones.");
    } finally {
      setLoading(false);
    }
  }

  // Si no se pasaron canciones iniciales (ej. modal del anfitrión), cargar al montar
  useEffect(() => {
    if (initialSongs.length === 0) {
      void fetchSongs("", "", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetchSongs(q, artist, genre);
  }

  async function handleAddClick(song: Song) {
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

    setAddingId(song.id);
    setError(null);
    try {
      const result = await onAddSong(song);
      if (result.ok) {
        setAddedIds((prev) => ({ ...prev, [song.id]: true }));
        setTimeout(() => {
          setAddedIds((prev) => {
            const copy = { ...prev };
            delete copy[song.id];
            return copy;
          });
        }, 3000);
      } else if (result.message) {
        setError(result.message);
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca canción o artista..."
              className="block w-full rounded-xl border border-white/10 bg-canvas py-3 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30 sm:text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-stage px-4 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filtrar por artista"
            value={artist}
            onChange={(e) => {
              const next = e.target.value;
              setArtist(next);
              void fetchSongs(q, next, genre);
            }}
            className="block w-full rounded-xl border border-white/10 bg-canvas px-3 py-2.5 text-xs text-ink focus:border-stage focus:outline-none sm:text-sm"
          >
            <option value="">Todos los artistas</option>
            {artists.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por género"
            value={genre}
            onChange={(e) => {
              const next = e.target.value;
              setGenre(next);
              void fetchSongs(q, artist, next);
            }}
            className="block w-full rounded-xl border border-white/10 bg-canvas px-3 py-2.5 text-xs text-ink focus:border-stage focus:outline-none sm:text-sm"
          >
            <option value="">Todos los géneros</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </form>

      {youtubeUsed && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-stage/10 px-3 py-1.5 text-xs text-stage">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Se encontraron nuevas canciones desde YouTube y se guardaron en el
          catálogo.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-xs text-live sm:text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-ink-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-stage" />
          Buscando canciones...
        </div>
      ) : songs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-canvas/50 p-8 text-center">
          <Music
            className="mx-auto h-7 w-7 text-ink-muted"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-medium text-ink">
            No encontramos resultados
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Escribe el nombre de una canción o artista arriba y pulsa Buscar.
          </p>
        </div>
      ) : (
        <ul
          className={`divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10 bg-canvas/50 ${
            compact ? "h-[380px]" : "h-[460px]"
          }`}
        >
          {songs.map((song) => {
            const isAdding = addingId === song.id;
            const justAdded = Boolean(addedIds[song.id]);

            return (
              <li
                key={song.id}
                className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-elevated/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      song.thumbnail_url ||
                      `https://i.ytimg.com/vi/${song.youtube_video_id}/mqdefault.jpg`
                    }
                    alt=""
                    className="h-12 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                      {song.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                      <span className="truncate">
                        {song.artist || song.channel_title || "Karaoke"}
                      </span>
                      {song.genre && (
                        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-stage">
                          {song.genre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAdding || Boolean(disabledReason)}
                  onClick={() => handleAddClick(song)}
                  title={disabledReason || "Agregar a la cola"}
                  className={`btn-party inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm ${
                    justAdded
                      ? "bg-ok/20 text-ok"
                      : "bg-stage text-canvas hover:bg-stage-hover"
                  }`}
                >
                  {isAdding ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span className="hidden sm:inline">Verificando...</span>
                    </>
                  ) : justAdded ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      ¡Lista! 🎉
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>Pedir</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
