import { NextResponse } from "next/server";
import { getCatalogFilters, searchCatalogSongs } from "@/lib/catalog/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const artist = searchParams.get("artist") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const rawLimit = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 30;
  const includeFilters = searchParams.get("includeFilters") !== "0";

  try {
    const result = await searchCatalogSongs({ q, artist, genre, limit });
    const filters = includeFilters ? await getCatalogFilters() : undefined;

    return NextResponse.json({
      songs: result.songs,
      source: result.source,
      youtubeFallbackUsed: result.youtubeFallbackUsed,
      ...(result.youtubeWarning ? { youtubeWarning: result.youtubeWarning } : {}),
      ...(filters ? { filters } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al buscar canciones en el catálogo.",
      },
      { status: 500 }
    );
  }
}
