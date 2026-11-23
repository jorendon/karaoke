import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Karaoke en Casa",
    template: "%s | Karaoke en Casa",
  },
  description:
    "Reproductor de karaoke para fiestas en casa con cola en tiempo real y código QR para invitados.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-canvas text-ink antialiased selection:bg-stage/30 selection:text-ink">
        {children}
      </body>
    </html>
  );
}
