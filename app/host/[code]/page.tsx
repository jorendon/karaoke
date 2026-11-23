import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateSessionQrDataUrl } from "@/lib/sessions";
import type { Session } from "@/lib/database.types";
import { HostSessionShell } from "./HostSessionShell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Sesión ${code}`,
    description: "Pantalla del anfitrión de Karaoke en Casa.",
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

  // Solo el dueño de la sesión puede abrir la pantalla del anfitrión
  if (session.owner_id !== user.id) {
    redirect("/dashboard");
  }

  const { publicUrl, qrDataUrl } = await generateSessionQrDataUrl(
    session.code
  );

  return (
    <HostSessionShell
      code={session.code}
      name={session.name}
      isActive={session.is_active}
      publicUrl={publicUrl}
      qrDataUrl={qrDataUrl}
    />
  );
}
