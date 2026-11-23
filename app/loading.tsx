import { Loader2, Mic2 } from "lucide-react";

export default function RootLoading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stage/15 text-stage">
        <Mic2 className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-ink-secondary">
        <Loader2 className="h-4 w-4 animate-spin text-stage" aria-hidden="true" />
        Cargando Karaoke en Casa...
      </div>
    </main>
  );
}
