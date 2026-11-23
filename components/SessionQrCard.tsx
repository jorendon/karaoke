"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface SessionQrCardProps {
  code: string;
  name: string;
  initialPublicUrl: string;
  initialQrDataUrl: string;
  compact?: boolean;
}

export function SessionQrCard({
  code,
  name,
  initialPublicUrl,
  initialQrDataUrl,
  compact = false,
}: SessionQrCardProps) {
  const [publicUrl, setPublicUrl] = useState(initialPublicUrl);
  const [qrDataUrl, setQrDataUrl] = useState(initialQrDataUrl);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar el enlace automáticamente.");
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${code}/qr`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        publicUrl?: string;
        qrDataUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.qrDataUrl || !data.publicUrl) {
        setError(data.error || "No se pudo regenerar el QR.");
        return;
      }
      setPublicUrl(data.publicUrl);
      setQrDataUrl(data.qrDataUrl);
    } catch {
      setError("Error de conexión al regenerar el QR.");
    } finally {
      setRegenerating(false);
    }
  }

  const shortDisplayUrl = publicUrl.replace(/^https?:\/\//, "");

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`rounded-2xl bg-white p-3.5 shadow-lg ${
          compact ? "w-52" : "w-64"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={`Código QR para la sesión ${name}`}
          className="h-auto w-full rounded-lg"
        />
      </div>

      <p className="mt-4 text-base font-semibold text-ink">
        Escanea para pedir tu canción
      </p>

      <a
        href={publicUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 inline-flex items-center gap-1.5 break-all rounded-lg bg-canvas/80 px-3 py-1.5 font-mono text-xs text-stage transition-colors hover:text-stage-hover"
      >
        <span>{shortDisplayUrl}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </a>

      {error && <p className="mt-2 text-xs text-live">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-white/20 hover:bg-elevated"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
              ¡Copiado!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copiar enlace
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Regenerar QR
        </button>

        <a
          href={qrDataUrl}
          download={`karaoke-${code}.png`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          PNG
        </a>
      </div>
    </div>
  );
}
