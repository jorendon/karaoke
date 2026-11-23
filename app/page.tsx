import { CheckCircle2, CircleAlert, Mic2, ShieldCheck } from "lucide-react";
import { getServerEnvStatus } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const ENV_ITEMS: Array<{
  key: keyof ReturnType<typeof getServerEnvStatus>;
  label: string;
  scope: "Pública" | "Solo servidor";
  requiredFromPhase: number;
}> = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "URL del proyecto Supabase",
    scope: "Pública",
    requiredFromPhase: 1,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Clave pública (anon) de Supabase",
    scope: "Pública",
    requiredFromPhase: 1,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Clave service_role de Supabase",
    scope: "Solo servidor",
    requiredFromPhase: 1,
  },
  {
    key: "AUTH_SECRET",
    label: "Secreto JWT para cookies de sesión",
    scope: "Solo servidor",
    requiredFromPhase: 2,
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "URL pública para enlaces y QR",
    scope: "Pública",
    requiredFromPhase: 3,
  },
  {
    key: "YOUTUBE_API_KEY",
    label: "YouTube Data API v3",
    scope: "Solo servidor",
    requiredFromPhase: 4,
  },
];

export default function HomePage() {
  const status = getServerEnvStatus();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-12">
      <div className="surface-card rounded-2xl p-8 sm:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stage/15 text-stage">
            <Mic2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stage">
              Fase 1 · Base lista
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Karaoke en Casa
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
          Proyecto Next.js App Router, Tailwind CSS en tema oscuro, tipos de base
          de datos y clientes de Supabase (navegador y servidor) configurados.
          En la Fase 2 esta ruta redirigirá automáticamente a{" "}
          <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">
            /dashboard
          </code>{" "}
          o{" "}
          <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-ink">
            /login
          </code>
          .
        </p>

        <section
          aria-labelledby="env-status-heading"
          className="mt-8 border-t border-white/10 pt-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2
              id="env-status-heading"
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-secondary"
            >
              <ShieldCheck className="h-4 w-4 text-stage" aria-hidden="true" />
              Estado de variables de entorno (.env.local)
            </h2>
          </div>

          <ul className="mt-4 space-y-2.5">
            {ENV_ITEMS.map((item) => {
              const configured = status[item.key];
              return (
                <li
                  key={item.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas/70 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    {configured ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-ok"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleAlert
                        className="h-4 w-4 shrink-0 text-stage"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="font-mono text-xs font-medium text-ink sm:text-sm">
                        {item.key}
                      </p>
                      <p className="text-xs text-ink-muted">{item.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-elevated px-2 py-0.5 text-xs text-ink-secondary">
                      {item.scope}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        configured
                          ? "bg-ok/15 text-ok"
                          : "bg-stage/15 text-stage"
                      }`}
                    >
                      {configured
                        ? "Configurada"
                        : `Pendiente (Fase ${item.requiredFromPhase})`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
