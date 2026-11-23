/**
 * Helpers para YouTube Data API v3 (uso exclusivo en servidor y scripts CLI).
 * Nunca importar este módulo desde componentes cliente.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubeVideoCandidate {
  youtube_video_id: string;
  title: string;
  artist: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

/**
 * Infiere `artist` únicamente si el título sigue un patrón claro "Artista - Canción".
 * Si no es evidente, devuelve artist = null para evitar datos incorrectos.
 */
export function inferArtistFromTitle(rawTitle: string): {
  title: string;
  artist: string | null;
} {
  const decoded = decodeHtmlEntities(rawTitle).replace(/\s+/g, " ").trim();
  const separatorMatch = decoded.match(/^(.{2,50}?)\s+[-–—]\s+(.{2,})$/);

  if (!separatorMatch) {
    return { title: decoded, artist: null };
  }

  const left = separatorMatch[1].trim();
  const right = separatorMatch[2].trim();

  // Evitar falsos positivos si el lado izquierdo es la palabra Karaoke
  if (/^karaoke\b/i.test(left) || left.length > 48) {
    return { title: decoded, artist: null };
  }

  return {
    artist: left,
    title: right,
  };
}

/**
 * Convierte una duración ISO 8601 de YouTube (ej. PT3M45S) a segundos.
 */
export function parseIsoDurationToSeconds(
  duration: string | undefined | null
): number | null {
  if (!duration) return null;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

interface YoutubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: { message?: string };
}

/**
 * Respaldo de búsqueda en YouTube Data API v3 (`search.list` = 100 unidades).
 * Solo debe llamarse cuando el catálogo local devuelve < 5 resultados y
 * respetando caché de 24 horas.
 */
export async function searchYoutubeKaraoke(
  query: string,
  apiKey: string,
  maxResults = 10
): Promise<YoutubeVideoCandidate[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const searchTerm = /\bkaraoke\b/i.test(cleanQuery)
    ? cleanQuery
    : `${cleanQuery} karaoke`;

  const params = new URLSearchParams({
    part: "snippet",
    q: searchTerm,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
    key: apiKey,
  });

  const response = await fetch(
    `${YOUTUBE_API_BASE}/search?${params.toString()}`,
    { cache: "no-store" }
  );

  const payload = (await response.json().catch(() => ({}))) as YoutubeSearchResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `YouTube search.list falló con estado ${response.status}`
    );
  }

  const results: YoutubeVideoCandidate[] = [];
  for (const item of payload.items ?? []) {
    const videoId = item.id?.videoId;
    const rawTitle = item.snippet?.title;
    if (!videoId || !rawTitle) continue;

    const { title, artist } = inferArtistFromTitle(rawTitle);
    const thumbnailUrl =
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    results.push({
      youtube_video_id: videoId,
      title,
      artist,
      channel_title: item.snippet?.channelTitle
        ? decodeHtmlEntities(item.snippet.channelTitle)
        : null,
      thumbnail_url: thumbnailUrl,
    });
  }

  return results;
}

interface YoutubeChannelsResponse {
  items?: Array<{
    id?: string;
    snippet?: { title?: string };
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
  error?: { message?: string };
}

/**
 * Resuelve la playlist de subidas de un canal usando `channels.list` (1 unidad).
 * Acepta tanto un ID de canal (`UC...`) como un handle (`@SingKing`).
 */
export async function resolveChannelUploadsPlaylist(
  channelIdentifier: string,
  apiKey: string
): Promise<{
  channelId: string;
  channelTitle: string;
  uploadsPlaylistId: string;
}> {
  const trimmed = channelIdentifier.trim();
  const params = new URLSearchParams({
    part: "contentDetails,snippet",
    key: apiKey,
  });

  if (trimmed.startsWith("@")) {
    params.set("forHandle", trimmed);
  } else if (/^UC[\w-]{20,}$/.test(trimmed)) {
    params.set("id", trimmed);
  } else {
    // Permite pasar un handle sin @ o un username
    params.set("forHandle", `@${trimmed.replace(/^@/, "")}`);
  }

  const response = await fetch(
    `${YOUTUBE_API_BASE}/channels?${params.toString()}`,
    { cache: "no-store" }
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as YoutubeChannelsResponse;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `YouTube channels.list falló con estado ${response.status}`
    );
  }

  const channel = payload.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel?.id || !uploadsPlaylistId) {
    throw new Error(
      `No se encontró el canal de YouTube "${channelIdentifier}". Verifica el ID (UC...) o @handle.`
    );
  }

  return {
    channelId: channel.id,
    channelTitle: decodeHtmlEntities(channel.snippet?.title || channel.id),
    uploadsPlaylistId,
  };
}

interface YoutubePlaylistItemsResponse {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      channelTitle?: string;
      videoOwnerChannelTitle?: string;
      resourceId?: { videoId?: string };
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: { message?: string };
}

/**
 * Obtiene una página de hasta 50 videos de una playlist (`playlistItems.list` = 1 unidad).
 */
export async function fetchPlaylistItemsPage(
  playlistId: string,
  apiKey: string,
  pageToken?: string
): Promise<{
  videos: YoutubeVideoCandidate[];
  nextPageToken: string | null;
}> {
  const params = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: "50",
    key: apiKey,
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(
    `${YOUTUBE_API_BASE}/playlistItems?${params.toString()}`,
    { cache: "no-store" }
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as YoutubePlaylistItemsResponse;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `YouTube playlistItems.list falló con estado ${response.status}`
    );
  }

  const videos: YoutubeVideoCandidate[] = [];
  for (const item of payload.items ?? []) {
    const videoId = item.snippet?.resourceId?.videoId;
    const rawTitle = item.snippet?.title;
    if (!videoId || !rawTitle) continue;

    // Ignorar videos privados o eliminados que YouTube devuelve con títulos genéricos
    if (rawTitle === "Private video" || rawTitle === "Deleted video") {
      continue;
    }

    const { title, artist } = inferArtistFromTitle(rawTitle);
    const channelTitle =
      item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || null;
    const thumbnailUrl =
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    videos.push({
      youtube_video_id: videoId,
      title,
      artist,
      channel_title: channelTitle ? decodeHtmlEntities(channelTitle) : null,
      thumbnail_url: thumbnailUrl,
    });
  }

  return {
    videos,
    nextPageToken: payload.nextPageToken ?? null,
  };
}
