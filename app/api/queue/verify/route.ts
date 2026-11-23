import { NextResponse } from "next/server";
import {
  UNPLAYABLE_VIDEO_MESSAGE,
  verifyYoutubeVideoForQueue,
} from "@/lib/youtube/verify";

export async function POST(request: Request) {
  let body: { youtubeVideoId?: unknown; youtube_video_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const videoId =
    typeof body.youtubeVideoId === "string"
      ? body.youtubeVideoId
      : typeof body.youtube_video_id === "string"
        ? body.youtube_video_id
        : "";

  if (!videoId.trim()) {
    return NextResponse.json(
      { error: "Falta youtubeVideoId." },
      { status: 400 }
    );
  }

  try {
    const result = await verifyYoutubeVideoForQueue(videoId);
    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.reason || UNPLAYABLE_VIDEO_MESSAGE,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      cached: result.cached,
      song: result.song,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al verificar el video en YouTube.",
      },
      { status: 500 }
    );
  }
}
