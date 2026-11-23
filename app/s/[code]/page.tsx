import type { Metadata } from "next";
import { Mic2 } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogFilters } from "@/lib/catalog/search";
import type { QueueItem, Session, Song } from "@/lib/database.types";
import { GuestScreenClient } from "./GuestScreenClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Fiesta ${code}`,
    description: "Pide tu canción de karaoke desde tu celular.",
  };
}

export default async function GuestSessionPage({ params }: PageProps) {
  const { code } = await params;
  const cleanCode = code.trim().toLowerCase();

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, code, name, is_active, closed_at")
    .eq("code", cleanCode)
    .maybeSingle();

  const session = data as Pick<
    Session,
    "id" | "code" | "name" | "is_active" | "closed_at"
  > | null;

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <div className="surface-card w-full rounded-2xl p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-live/15 text-live">
            <Mic2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-ink">
            Sesión no encontrada
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            El código{" "}
            <span className="font-mono text-ink">{cleanCode}</span> no existe o
            el enlace es incorrecto. Pídele al anfitrión que te muestre el QR
            nuevamente.
          </p>
        </div>
      </main>
    );
  }

  if (!session.is_active) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <div className="surface-card w-full rounded-2xl p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            {session.name}
          </p>
          <h1 className="mt-3 text-2xl font-bold text-ink">
            Esta sesión terminó 🎤
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Gracias por cantar. El anfitrión ya cerró esta fiesta y no se pueden
            agregar más canciones.
          </p>
        </div>
      </main>
    );
  }

  const [{ data: queueData }, { data: songsData }, filters] = await Promise.all(
    [
      supabase
        .from("queue_items")
        .select(
          "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
        )
        .eq("session_id", session.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("songs")
        .select(
          "id, youtube_video_id, title, artist, genre, channel_title, thumbnail_url, duration_seconds, is_embeddable, last_verified_at, created_at"
        )
        .eq("is_embeddable", true)
        .order("created_at", { ascending: false })
        .limit(30),
      getCatalogFilters(),
    ]
  );

  return (
    <GuestScreenClient
      sessionId={session.id}
      code={session.code}
      name={session.name}
      initialIsActive={session.is_active}
      initialQueue={(queueData ?? []) as QueueItem[]}
      initialSongs={(songsData ?? []) as Song[]}
      initialArtists={filters.artists}
      initialGenres={filters.genres}
    />
  );
}
