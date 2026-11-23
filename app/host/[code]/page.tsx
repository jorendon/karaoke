import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateSessionQrDataUrl } from "@/lib/sessions";
import type { QueueItem, Session } from "@/lib/database.types";
import { HostScreenClient } from "./HostScreenClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Pantalla anfitrión · ${code}`,
    description: "Reproductor de karaoke y cola en vivo para el anfitrión.",
  };
}

export default async function HostSessionPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { code } = await params;
  const cleanCode = code.trim().toLowerCase();

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, code, name, owner_id, is_active, created_at, closed_at")
    .eq("code", cleanCode)
    .maybeSingle();

  const session = data as Session | null;
  if (!session) {
    notFound();
  }

  // Solo el dueño de la sesión puede controlar la pantalla del anfitrión
  if (session.owner_id !== user.id) {
    redirect("/dashboard");
  }

  const [{ publicUrl, qrDataUrl }, { data: queueData }] = await Promise.all([
    generateSessionQrDataUrl(session.code),
    supabase
      .from("queue_items")
      .select(
        "id, session_id, song_id, youtube_video_id, title, artist, requested_by, position, status, created_at"
      )
      .eq("session_id", session.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  return (
    <HostScreenClient
      sessionId={session.id}
      code={session.code}
      name={session.name}
      initialIsActive={session.is_active}
      initialQueue={(queueData ?? []) as QueueItem[]}
      publicUrl={publicUrl}
      qrDataUrl={qrDataUrl}
      hostDisplayName={user.display_name || user.username}
    />
  );
}
