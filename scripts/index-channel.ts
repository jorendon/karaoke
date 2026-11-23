import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  fetchPlaylistItemsPage,
  resolveChannelUploadsPlaylist,
} from "../lib/youtube/api";

// Carga .env.local automáticamente si existe
dotenv.config({ path: ".env.local", override: true });

function printUsage() {
  console.log(`
Uso:
  npx tsx scripts/index-channel.ts <channelId_o_@handle> [--pages 5] [--genre "Pop"]

Ejemplos:
  npx tsx scripts/index-channel.ts @SingKing --pages 4
  npx tsx scripts/index-channel.ts UC... --pages 10 --genre "Rock en español"

Canales iniciales recomendados para buscar sus IDs/@handles verificados:
  - Sing King
  - KaraokeOnVEVO
  - Pocket Songs
  - Zoom Karaoke
  - Sing2Music

Costo de cuota YouTube Data API v3:
  1 unidad (channels.list) + 1 unidad por página de 50 videos (playlistItems.list).
`);
}

function parseArgs(argv: string[]) {
  let channel = "";
  let pages = 5;
  let genre: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--channel" && argv[i + 1]) {
      channel = argv[++i];
    } else if (arg === "--pages" && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed >= 1) {
        pages = Math.floor(parsed);
      }
    } else if (arg === "--genre" && argv[i + 1]) {
      genre = argv[++i].trim() || null;
    } else if (!arg.startsWith("--") && !channel) {
      channel = arg;
    }
  }

  return { channel: channel.trim(), pages, genre };
}

async function main() {
  const { channel, pages, genre } = parseArgs(process.argv.slice(2));
  if (!channel) {
    console.error("Error: debes indicar un ID de canal (UC...) o @handle.");
    printUsage();
    process.exit(1);
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!apiKey) {
    console.error("Error: falta YOUTUBE_API_KEY en .env.local");
    process.exit(1);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Error: faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Resolviendo canal "${channel}"...`);
  const resolved = await resolveChannelUploadsPlaylist(channel, apiKey);
  console.log(
    `Canal encontrado: ${resolved.channelTitle} (${resolved.channelId})`
  );
  console.log(`Playlist de subidas: ${resolved.uploadsPlaylistId}`);

  let pageToken: string | undefined;
  let pagesFetched = 0;
  let totalUpserted = 0;

  while (pagesFetched < pages) {
    const page = await fetchPlaylistItemsPage(
      resolved.uploadsPlaylistId,
      apiKey,
      pageToken
    );
    pagesFetched++;

    if (page.videos.length > 0) {
      const ids = page.videos.map((v) => v.youtube_video_id);
      const { data: existingRows } = await supabase
        .from("songs")
        .select("youtube_video_id, artist, genre")
        .in("youtube_video_id", ids);

      const existingMap = new Map<
        string,
        { artist: string | null; genre: string | null }
      >();
      for (const row of existingRows ?? []) {
        const r = row as {
          youtube_video_id: string;
          artist: string | null;
          genre: string | null;
        };
        existingMap.set(r.youtube_video_id, {
          artist: r.artist,
          genre: r.genre,
        });
      }

      const upsertRows = page.videos.map((v) => {
        const existing = existingMap.get(v.youtube_video_id);
        return {
          youtube_video_id: v.youtube_video_id,
          title: v.title,
          artist: existing?.artist ?? v.artist,
          genre: existing?.genre ?? genre,
          channel_title: v.channel_title,
          thumbnail_url: v.thumbnail_url,
          is_embeddable: true,
        };
      });

      const { error } = await supabase.from("songs").upsert(upsertRows, {
        onConflict: "youtube_video_id",
      });

      if (error) {
        throw new Error(`Error en upsert de página ${pagesFetched}: ${error.message}`);
      }

      totalUpserted += upsertRows.length;
      console.log(
        `Página ${pagesFetched}/${pages}: ${upsertRows.length} videos procesados (acumulado: ${totalUpserted}).`
      );
    }

    if (!page.nextPageToken) {
      console.log("Fin de la playlist de subidas.");
      break;
    }
    pageToken = page.nextPageToken;
  }

  console.log(
    `\nListo: ${totalUpserted} canciones guardadas/actualizadas en 'songs' (~${1 + pagesFetched} unidades de cuota usadas).`
  );
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
