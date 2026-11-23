import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildSessionPublicUrl } from "@/lib/sessions";
import type { Playlist, PlaylistItem, Session } from "@/lib/database.types";
import { AppHeader } from "@/components/AppHeader";
import type { SavedPlaylist } from "@/components/PlaylistsSection";
import { DashboardClient, type DashboardSession } from "./DashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Panel del anfitrión para gestionar sesiones de karaoke.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = getSupabaseServerClient();
  const [{ data: sessionsData }, { data: playlistsData }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, code, name, owner_id, is_active, created_at, closed_at")
      .eq("owner_id", user.id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, owner_id, name, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const rawSessions = (sessionsData ?? []) as Session[];
  const sessionIds = rawSessions.map((s) => s.id);
  const rawPlaylists = (playlistsData ?? []) as Playlist[];
  const playlistIds = rawPlaylists.map((p) => p.id);

  const [queueRes, playlistItemsRes] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from("queue_items")
          .select("session_id")
          .in("session_id", sessionIds)
          .in("status", ["pending", "playing"])
      : Promise.resolve({ data: [] }),
    playlistIds.length > 0
      ? supabase
          .from("playlist_items")
          .select(
            "id, playlist_id, song_id, youtube_video_id, title, artist, position, created_at"
          )
          .in("playlist_id", playlistIds)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const queueCounts = new Map<string, number>();
  for (const row of queueRes.data ?? []) {
    const sid = (row as { session_id: string }).session_id;
    queueCounts.set(sid, (queueCounts.get(sid) ?? 0) + 1);
  }

  const itemsByPlaylist = new Map<string, PlaylistItem[]>();
  for (const row of (playlistItemsRes.data ?? []) as PlaylistItem[]) {
    const list = itemsByPlaylist.get(row.playlist_id) ?? [];
    list.push(row);
    itemsByPlaylist.set(row.playlist_id, list);
  }

  const initialSessions: DashboardSession[] = rawSessions.map((session) => ({
    ...session,
    publicUrl: buildSessionPublicUrl(session.code),
    activeQueueCount: queueCounts.get(session.id) ?? 0,
  }));

  const initialPlaylists: SavedPlaylist[] = rawPlaylists.map((playlist) => ({
    ...playlist,
    items: itemsByPlaylist.get(playlist.id) ?? [],
  }));

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader user={user} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Hola, {user.display_name || user.username}
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Administra tus fiestas de karaoke, playlists guardadas y comparte
              el QR con tus invitados.
            </p>
          </div>

          {user.role === "admin" && (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-white/20 hover:bg-elevated"
            >
              <Users className="h-4 w-4 text-stage" aria-hidden="true" />
              Administrar usuarios
            </Link>
          )}
        </div>

        <DashboardClient
          initialSessions={initialSessions}
          initialPlaylists={initialPlaylists}
        />
      </main>
    </div>
  );
}
