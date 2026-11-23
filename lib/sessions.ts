import "server-only";

import { randomInt } from "node:crypto";
import QRCode from "qrcode";
import { getPublicAppUrl } from "@/lib/env";

// Alfabeto de 8 caracteres en minúsculas sin caracteres ambiguos (sin 0, o, 1, l, i)
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 8;

export function generateSessionCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

export function buildSessionPublicUrl(code: string): string {
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/s/${encodeURIComponent(code)}`;
}

export async function generateSessionQrDataUrl(code: string): Promise<{
  publicUrl: string;
  qrDataUrl: string;
}> {
  const publicUrl = buildSessionPublicUrl(code);
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    type: "image/png",
    width: 440,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0b0b0e",
      light: "#ffffff",
    },
  });

  return { publicUrl, qrDataUrl };
}
