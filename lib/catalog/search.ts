import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getYoutubeApiKey } from "@/lib/env.server";
import {
  fetchPlaylistItemsPage,
  resolveChannelUploadsPlaylist,
  searchYoutubeKaraoke,
  type YoutubeVideoCandidate,
} from "@/lib/youtube/api";
import type { Song } from "@/lib/database.types";

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const YOUTUBE_FALLBACK_THRESHOLD = 5;

// Caché en memoria del servidor (clave: consulta normalizada -> timestamp ms)
const youtubeSearchCache = new Map<string, number>();

function normalizeCacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeForIlike(term: string): string {
  return term.replace(/[\\%_,()]/g, (ch) => `\\${ch}`);
}

function isQueryCachedInMemory(normalizedKey: string): boolean {
  const lastFetched = youtubeSearchCache.get(normalizedKey);
  if (!lastFetched) return false;
  if (Date.now() - lastFetched < SEARCH_CACHE_TTL_MS) {
    return true;
  }
  youtubeSearchCache.delete(normalizedKey);
  return false;
}

export interface CatalogFilters {
  artists: string[];
  genres: string[];
}

export async function getCatalogFilters(): Promise<CatalogFilters> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("songs")
    .select("artist, genre")
    .eq("is_embeddable", true)
    .limit(5000);

  const artistSet = new Set<string>();
  const genreSet = new Set<string>();

  for (const row of data ?? []) {
    const item = row as { artist: string | null; genre: string | null };
    if (item.artist?.trim()) artistSet.add(item.artist.trim());
    if (item.genre?.trim()) genreSet.add(item.genre.trim());
  }

  return {
    artists: Array.from(artistSet).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    ),
    genres: Array.from(genreSet).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    ),
  };
}

async function queryLocalSongs(params: {
  q: string;
  artist: string;
  genre: string;
  limit: number;
}): Promise<Song[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("songs")
    .select(
      "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
    )
    .eq("is_embeddable", true);

  if (params.q) {
    const escaped = escapeForIlike(params.q);
    query = query.or(`title.ilike.%${escaped}%,artist.ilike.%${escaped}%`);
  }

  if (params.artist) {
    query = query.eq("artist", params.artist);
  }

  if (params.genre) {
    query = query.eq("genre", params.genre);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (error) {
    throw new Error(`Error al buscar en catálogo local: ${error.message}`);
  }

  return (data ?? []) as Song[];
}

async function insertNewCandidatesIntoSongs(
  candidates: YoutubeVideoCandidate[],
  defaultGenre?: string | null
): Promise<{ addedCount: number; skippedExistingCount: number }> {
  if (candidates.length === 0) {
    return { addedCount: 0, skippedExistingCount: 0 };
  }

  // Deduplicar dentro del mismo lote por si YouTube repite un video
  const uniqueByVideoId = new Map<string, YoutubeVideoCandidate>();
  for (const candidate of candidates) {
    if (!uniqueByVideoId.has(candidate.youtube_video_id)) {
      uniqueByVideoId.set(candidate.youtube_video_id, candidate);
    }
  }
  const uniqueCandidates = Array.from(uniqueByVideoId.values());
  const inBatchDuplicates = candidates.length - uniqueCandidates.length;

  const supabase = getSupabaseServerClient();
  const ids = uniqueCandidates.map((c) => c.youtube_video_id);

  // Verificar primero cuáles ya existen en la base de datos para no repetir ni sobrescribir
  const { data: existingRows, error: checkError } = await supabase
    .from("songs")
    .select("youtube_video_id")
    .in("youtube_video_id", ids);

  if (checkError) {
    throw new Error(
      `Error al verificar duplicados en catálogo: ${checkError.message}`
    );
  }

  const existingIds = new Set<string>(
    (existingRows ?? []).map(
      (row) => (row as { youtube_video_id: string }).youtube_video_id
    )
  );

  const newCandidates = uniqueCandidates.filter(
    (candidate) => !existingIds.has(candidate.youtube_video_id)
  );

  const skippedExistingCount =
    uniqueCandidates.length - newCandidates.length + inBatchDuplicates;

  if (newCandidates.length === 0) {
    return { addedCount: 0, skippedExistingCount };
  }

  const rowsToInsert = newCandidates.map((candidate) => ({
    youtube_video_id: candidate.youtube_video_id,
    title: candidate.title,
    artist: candidate.artist,
    genre: defaultGenre || null,
    channel_title: candidate.channel_title,
    thumbnail_url: candidate.thumbnail_url,
    is_embeddable: true,
  }));

  const { error } = await supabase.from("songs").upsert(rowsToInsert, {
    onConflict: "youtube_video_id",
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(`Error al guardar canciones en catálogo: ${error.message}`);
  }

  return {
    addedCount: rowsToInsert.length,
    skippedExistingCount,
  };
}

export interface SearchSongsResult {
  songs: Song[];
  source: "catalog" | "youtube_fallback";
  youtubeFallbackUsed: boolean;
  youtubeWarning?: string;
}

/**
 * Busca canciones primero en la tabla `songs` (sin gastar cuota).
 * Si devuelve menos de 5 resultados y hay `q` (>= 2 chars) sin filtro estricto
 * que impida resultados nuevos, consulta YouTube Data API v3 con caché de 24h
 * y hace upsert en `songs`.
 */
export async function searchCatalogSongs(options: {
  q?: string;
  artist?: string;
  genre?: string;
  limit?: number;
}): Promise<SearchSongsResult> {
  const q = options.q?.trim() ?? "";
  const artist = options.artist?.trim() ?? "";
  const genre = options.genre?.trim() ?? "";
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 60);

  let songs = await queryLocalSongs({ q, artist, genre, limit });

  // Respaldo YouTube solo si hay texto de búsqueda, menos de 5 resultados y sin filtros cerrados
  const shouldAttemptFallback =
    q.length >= 2 &&
    !artist &&
    !genre &&
    songs.length < YOUTUBE_FALLBACK_THRESHOLD;

  if (!shouldAttemptFallback) {
    return {
      songs,
      source: "catalog",
      youtubeFallbackUsed: false,
    };
  }

  const cacheKey = normalizeCacheKey(q);
  if (isQueryCachedInMemory(cacheKey)) {
    return {
      songs,
      source: "catalog",
      youtubeFallbackUsed: false,
    };
  }

  // También evitar repetir búsquedas recientes si ya hay resultados recién guardados en las últimas 24h
  const hasRecentFreshBatch =
    songs.length >= 3 &&
    songs.some(
      (s) => Date.now() - new Date(s.created_at).getTime() < SEARCH_CACHE_TTL_MS
    );

  if (hasRecentFreshBatch) {
    youtubeSearchCache.set(cacheKey, Date.now());
    return {
      songs,
      source: "catalog",
      youtubeFallbackUsed: false,
    };
  }

  let apiKey: string;
  try {
    apiKey = getYoutubeApiKey();
  } catch {
    return {
      songs,
      source: "catalog",
      youtubeFallbackUsed: false,
      youtubeWarning: "YOUTUBE_API_KEY no está configurada en el servidor.",
    };
  }

  try {
    const candidates = await searchYoutubeKaraoke(q, apiKey, 10);
    // Registrar en caché 24h incluso si vino vacío para no repetir la consulta
    youtubeSearchCache.set(cacheKey, Date.now());

    if (candidates.length > 0) {
      await insertNewCandidatesIntoSongs(candidates);

      // Combinar resultados locales con los recién guardados (por si el título de YouTube varía respecto a `q`)
      const refreshedLocal = await queryLocalSongs({ q, artist, genre, limit });
      const seenIds = new Set(refreshedLocal.map((s) => s.youtube_video_id));

      const missingIds = candidates
        .map((c) => c.youtube_video_id)
        .filter((id) => !seenIds.has(id));

      if (missingIds.length > 0) {
        const supabase = getSupabaseServerClient();
        const { data: extraSongs } = await supabase
          .from("songs")
          .select(
            "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
          )
          .in("youtube_video_id", missingIds)
          .eq("is_embeddable", true);

        songs = [...refreshedLocal, ...((extraSongs ?? []) as Song[])].slice(
          0,
          limit
        );
      } else {
        songs = refreshedLocal;
      }
    }

    return {
      songs,
      source: "youtube_fallback",
      youtubeFallbackUsed: true,
    };
  } catch (err) {
    return {
      songs,
      source: "catalog",
      youtubeFallbackUsed: false,
      youtubeWarning:
        err instanceof Error
          ? err.message
          : "No se pudo consultar YouTube como respaldo.",
    };
  }
}

/**
 * Indexa páginas de subidas de un canal de YouTube en `songs`,
 * omitiendo videos que ya existan en la base de datos para nunca duplicar
 * ni sobrescribir metadatos editados.
 * Costo: 1 unidad (channels.list) + 1 unidad por página de 50 videos (playlistItems.list).
 */
export async function indexYoutubeChannel(options: {
  channelIdentifier: string;
  maxPages?: number;
  defaultGenre?: string | null;
}): Promise<{
  channelId: string;
  channelTitle: string;
  pagesFetched: number;
  addedCount: number;
  skippedExistingCount: number;
  videosProcessed: number;
  totalCatalogCount: number;
  quotaUnitsEstimate: number;
}> {
  const apiKey = getYoutubeApiKey();
  const maxPages = Math.min(Math.max(options.maxPages ?? 2, 1), 10);

  const channel = await resolveChannelUploadsPlaylist(
    options.channelIdentifier,
    apiKey
  );

  let pageToken: string | undefined;
  let pagesFetched = 0;
  let addedCount = 0;
  let skippedExistingCount = 0;

  while (pagesFetched < maxPages) {
    const page = await fetchPlaylistItemsPage(
      channel.uploadsPlaylistId,
      apiKey,
      pageToken
    );
    pagesFetched++;

    if (page.videos.length > 0) {
      const stats = await insertNewCandidatesIntoSongs(
        page.videos,
        options.defaultGenre ?? null
      );
      addedCount += stats.addedCount;
      skippedExistingCount += stats.skippedExistingCount;
    }

    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  const supabase = getSupabaseServerClient();
  const { count } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("is_embeddable", true);

  return {
    channelId: channel.channelId,
    channelTitle: channel.channelTitle,
    pagesFetched,
    addedCount,
    skippedExistingCount,
    videosProcessed: addedCount + skippedExistingCount,
    totalCatalogCount: count ?? 0,
    quotaUnitsEstimate: 1 + pagesFetched,
  };
}
