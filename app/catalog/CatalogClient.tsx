"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Loader2,
  Music,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { SUGGESTED_GENRES, type Song } from "@/lib/database.types";

interface CatalogClientProps {
  initialSongs: Song[];
  initialArtists: string[];
  initialGenres: string[];
  totalCatalogCount: number;
}

export function CatalogClient({
  initialSongs,
  initialArtists,
  initialGenres,
  totalCatalogCount,
}: CatalogClientProps) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [artists, setArtists] = useState<string[]>(initialArtists);
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [totalCount, setTotalCount] = useState<number>(totalCatalogCount);

  // Búsqueda y filtros
  const [q, setQ] = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [lastSource, setLastSource] = useState<
    "catalog" | "youtube_fallback" | null
  >(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  // Indexación de canales
  const [channelInput, setChannelInput] = useState("");
  const [maxPages, setMaxPages] = useState(2);
  const [defaultGenre, setDefaultGenre] = useState("");
  const [indexing, setIndexing] = useState(false);

  // Edición inline de canción
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function runSearch(nextQ: string, nextArtist: string, nextGenre: string) {
    setSearching(true);
    setSearchNotice(null);
    try {
      const params = new URLSearchParams({ limit: "30", includeFilters: "1" });
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextArtist) params.set("artist", nextArtist);
      if (nextGenre) params.set("genre", nextGenre);

      const response = await fetch(`/api/songs/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        songs?: Song[];
        source?: "catalog" | "youtube_fallback";
        youtubeWarning?: string;
        filters?: { artists: string[]; genres: string[] };
        error?: string;
      };

      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Error al buscar canciones.",
        });
        return;
      }

      setSongs(data.songs ?? []);
      setLastSource(data.source ?? "catalog");
      if (data.filters) {
        setArtists(data.filters.artists);
        setGenres(data.filters.genres);
      }
      if (data.youtubeWarning) {
        setSearchNotice(data.youtubeWarning);
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al buscar en el catálogo.",
      });
    } finally {
      setSearching(false);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(q, artistFilter, genreFilter);
  }

  async function handleIndexChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!channelInput.trim()) return;

    setIndexing(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/songs/index-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelInput.trim(),
          maxPages,
          genre: defaultGenre || null,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        channelTitle?: string;
        videosProcessed?: number;
        quotaUnitsEstimate?: number;
        error?: string;
      };

      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo indexar el canal.",
        });
        return;
      }

      setFeedback({
        type: "success",
        text: `Canal "${data.channelTitle}" indexado: ${data.videosProcessed} canciones procesadas (~${data.quotaUnitsEstimate} unidades de cuota).`,
      });
      setChannelInput("");
      setTotalCount((prev) => prev + (data.videosProcessed ?? 0));
      await runSearch(q, artistFilter, genreFilter);
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al indexar el canal.",
      });
    } finally {
      setIndexing(false);
    }
  }

  function openEditModal(song: Song) {
    setEditingSong(song);
    setEditTitle(song.title);
    setEditArtist(song.artist ?? "");
    setEditGenre(song.genre ?? "");
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSong) return;

    setSavingEdit(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/songs/${editingSong.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          artist: editArtist,
          genre: editGenre || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        song?: Song;
        error?: string;
      };

      if (!response.ok || !data.song) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo guardar la edición.",
        });
        return;
      }

      setSongs((prev) =>
        prev.map((item) => (item.id === editingSong.id ? data.song! : item))
      );
      if (data.song.artist && !artists.includes(data.song.artist)) {
        setArtists((prev) =>
          [...prev, data.song!.artist!].sort((a, b) => a.localeCompare(b, "es"))
        );
      }
      if (data.song.genre && !genres.includes(data.song.genre)) {
        setGenres((prev) =>
          [...prev, data.song!.genre!].sort((a, b) => a.localeCompare(b, "es"))
        );
      }
      setEditingSong(null);
      setFeedback({
        type: "success",
        text: "Canción actualizada en el catálogo.",
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al actualizar la canción.",
      });
    } finally {
      setSavingEdit(false);
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

      {/* Indexar canal de YouTube */}
      <section
        aria-labelledby="index-channel-heading"
        className="surface-card rounded-2xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Download className="h-5 w-5 text-stage" aria-hidden="true" />
            <h2
              id="index-channel-heading"
              className="text-lg font-semibold text-ink"
            >
              Indexar canal de karaoke de YouTube
            </h2>
          </div>
          <span className="rounded-md bg-elevated px-2.5 py-1 text-xs text-ink-secondary">
            1 unidad por cada 50 canciones
          </span>
        </div>

        <p className="mt-1.5 text-sm text-ink-secondary">
          Puebla tu catálogo propio sin gastar cuota en búsquedas futuras.
          Canales recomendados para probar sus @handles o IDs verificados:{" "}
          <span className="text-ink">
            Sing King, KaraokeOnVEVO, Pocket Songs, Zoom Karaoke, Sing2Music
          </span>
          .
        </p>

        <form
          onSubmit={handleIndexChannel}
          className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-12"
        >
          <div className="sm:col-span-5">
            <label
              htmlFor="channel-identifier"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              ID de canal (UC...) o @handle
            </label>
            <input
              id="channel-identifier"
              type="text"
              required
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="Ej. @SingKing o UC..."
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="channel-pages"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              Páginas (×50)
            </label>
            <select
              id="channel-pages"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            >
              <option value={1}>1 (50)</option>
              <option value={2}>2 (100)</option>
              <option value={4}>4 (200)</option>
              <option value={6}>6 (300)</option>
              <option value={10}>10 (500)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="channel-genre"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              Género por defecto (opcional)
            </label>
            <select
              id="channel-genre"
              value={defaultGenre}
              onChange={(e) => setDefaultGenre(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            >
              <option value="">Sin asignar</option>
              {SUGGESTED_GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={indexing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stage px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover disabled:opacity-60"
            >
              {indexing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Indexando...
                </>
              ) : (
                "Indexar"
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Buscador y filtros */}
      <section
        aria-labelledby="catalog-search-heading"
        className="surface-card rounded-2xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="catalog-search-heading"
            className="flex items-center gap-2 text-lg font-semibold text-ink"
          >
            <Music className="h-5 w-5 text-stage" aria-hidden="true" />
            Explorar y editar catálogo ({totalCount} canciones)
          </h2>

          {lastSource === "youtube_fallback" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-stage/15 px-2.5 py-1 text-xs font-medium text-stage">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Nuevos resultados guardados desde YouTube
            </span>
          )}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12"
        >
          <div className="relative sm:col-span-5">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar canción o artista..."
              className="block w-full rounded-xl border border-white/10 bg-canvas py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              aria-label="Filtrar por artista"
              value={artistFilter}
              onChange={(e) => {
                const next = e.target.value;
                setArtistFilter(next);
                runSearch(q, next, genreFilter);
              }}
              className="block w-full rounded-xl border border-white/10 bg-canvas px-3 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            >
              <option value="">Todos los artistas ({artists.length})</option>
              {artists.map((artist) => (
                <option key={artist} value={artist}>
                  {artist}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              aria-label="Filtrar por género"
              value={genreFilter}
              onChange={(e) => {
                const next = e.target.value;
                setGenreFilter(next);
                runSearch(q, artistFilter, next);
              }}
              className="block w-full rounded-xl border border-white/10 bg-canvas px-3 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            >
              <option value="">Todos los géneros ({genres.length})</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={searching}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-elevated px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-hover disabled:opacity-60"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              Buscar
            </button>
          </div>
        </form>

        {searchNotice && (
          <p className="mt-3 text-xs text-stage">{searchNotice}</p>
        )}

        {/* Resultados */}
        <div className="mt-6">
          {songs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-canvas/50 p-10 text-center">
              <p className="text-sm font-medium text-ink">
                No se encontraron canciones todavía
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                Busca cualquier canción arriba (se consultará YouTube como
                respaldo y se guardará automáticamente) o indexa un canal de
                karaoke.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-canvas/50">
              {songs.map((song) => (
                <li
                  key={song.id}
                  className="flex items-center justify-between gap-4 p-3.5 transition-colors hover:bg-elevated/40"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
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
                      <p className="truncate text-sm font-semibold text-ink">
                        {song.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                        <span>{song.artist || "Sin artista"}</span>
                        {song.genre && (
                          <span className="rounded bg-elevated px-2 py-0.5 text-[11px] text-stage">
                            {song.genre}
                          </span>
                        )}
                        {song.channel_title && (
                          <span className="truncate text-ink-muted">
                            · {song.channel_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditModal(song)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Modal de edición de canción */}
      {editingSong && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-song-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setEditingSong(null)}
        >
          <div
            className="surface-card relative w-full max-w-md rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEditingSong(null)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h3 id="edit-song-title" className="text-lg font-bold text-ink">
              Editar metadatos de canción
            </h3>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              YouTube ID: {editingSong.youtube_video_id}
            </p>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-song-name"
                  className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
                >
                  Título
                </label>
                <input
                  id="edit-song-name"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-song-artist"
                  className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
                >
                  Artista
                </label>
                <input
                  id="edit-song-artist"
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  placeholder="Ej. Luis Miguel"
                  className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-song-genre"
                  className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
                >
                  Género
                </label>
                <select
                  id="edit-song-genre"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
                >
                  <option value="">Sin género</option>
                  {SUGGESTED_GENRES.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="rounded-xl border border-white/10 bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-elevated hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-stage px-5 py-2 text-sm font-semibold text-canvas hover:bg-stage-hover disabled:opacity-60"
                >
                  {savingEdit ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
