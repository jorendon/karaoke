import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogFilters } from "@/lib/catalog/search";
import type { Song } from "@/lib/database.types";
import { AppHeader } from "@/components/AppHeader";
import { CatalogClient } from "./CatalogClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo de canciones",
  description: "Explora, edita e indexa canciones de karaoke en tu catálogo.",
};

export default async function CatalogPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = getSupabaseServerClient();
  const [{ data: songsData }, { count }, filters] = await Promise.all([
    supabase
      .from("songs")
      .select(
        "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
      )
      .eq("is_embeddable", true)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("songs")
      .select("id", { count: "exact", head: true })
      .eq("is_embeddable", true),
    getCatalogFilters(),
  ]);

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader user={user} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Catálogo de Karaoke
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Busca canciones con respaldo automático de YouTube (cacheado 24 h),
            etiqueta artistas/géneros o indexa canales completos de karaoke.
          </p>
        </div>

        <CatalogClient
          initialSongs={(songsData ?? []) as Song[]}
          initialArtists={filters.artists}
          initialGenres={filters.genres}
          totalCatalogCount={count ?? 0}
        />
      </main>
    </div>
  );
}
