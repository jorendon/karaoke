import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { indexYoutubeChannel } from "@/lib/catalog/search";

export async function POST(request: Request) {
  const auth = await requireCurrentUser();
  if (auth.response) return auth.response;

  let body: {
    channel?: unknown;
    maxPages?: unknown;
    genre?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  if (!channel) {
    return NextResponse.json(
      {
        error:
          "Ingresa el ID de canal (UC...) o el @handle del canal de YouTube.",
      },
      { status: 400 }
    );
  }

  const rawPages = Number(body.maxPages ?? 2);
  const maxPages = Number.isFinite(rawPages)
    ? Math.min(Math.max(Math.floor(rawPages), 1), 10)
    : 2;

  const defaultGenre =
    typeof body.genre === "string" && body.genre.trim()
      ? body.genre.trim().slice(0, 60)
      : null;

  try {
    const result = await indexYoutubeChannel({
      channelIdentifier: channel,
      maxPages,
      defaultGenre,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo indexar el canal de YouTube.",
      },
      { status: 400 }
    );
  }
}
