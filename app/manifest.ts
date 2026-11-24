import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Karaoke en Casa",
    short_name: "Karaoke",
    description:
      "Reproductor de karaoke para fiestas en casa con cola en tiempo real y QR.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
