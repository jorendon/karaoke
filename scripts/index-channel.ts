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
  let totalAdded = 0;
  let totalSkipped = 0;

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
        .select("youtube_video_id")
        .in("youtube_video_id", ids);

      const existingIds = new Set<string>(
        (existingRows ?? []).map(
          (row) => (row as { youtube_video_id: string }).youtube_video_id
        )
      );

      const newVideos = page.videos.filter(
        (v) => !existingIds.has(v.youtube_video_id)
      );
      const skippedInPage = page.videos.length - newVideos.length;
      totalSkipped += skippedInPage;

      if (newVideos.length > 0) {
        const insertRows = newVideos.map((v) => ({
          youtube_video_id: v.youtube_video_id,
          title: v.title,
          artist: v.artist,
          genre,
          channel_title: v.channel_title,
          thumbnail_url: v.thumbnail_url,
          is_embeddable: true,
        }));

        const { error } = await supabase.from("songs").upsert(insertRows, {
          onConflict: "youtube_video_id",
          ignoreDuplicates: true,
        });

        if (error) {
          throw new Error(
            `Error al insertar página ${pagesFetched}: ${error.message}`
          );
        }

        totalAdded += insertRows.length;
      }

      console.log(
        `Página ${pagesFetched}/${pages}: ${newVideos.length} nuevos, ${skippedInPage} ya existían (omitidos).`
      );
    }

    if (!page.nextPageToken) {
      console.log("Fin de la playlist de subidas.");
      break;
    }
    pageToken = page.nextPageToken;
  }

  console.log(
    `\nListo: ${totalAdded} canciones nuevas agregadas, ${totalSkipped} ya existían en 'songs' (omitidas). Cuota aprox: ${1 + pagesFetched} unidades.`
  );
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
