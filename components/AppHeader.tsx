"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LogOut, Mic2, Shield, Users } from "lucide-react";
import type { PublicAppUser } from "@/lib/database.types";

interface AppHeaderProps {
  user: PublicAppUser;
}

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const navLinkClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-elevated text-ink"
        : "text-ink-secondary hover:bg-elevated/60 hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-ink transition-opacity hover:opacity-90"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stage/15 text-stage">
              <Mic2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-bold tracking-tight">
              Karaoke en Casa
            </span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-1 sm:flex">
            <Link
              href="/dashboard"
              className={navLinkClass(pathname === "/dashboard")}
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Sesiones
            </Link>

            {user.role === "admin" && (
              <Link
                href="/admin/users"
                className={navLinkClass(pathname.startsWith("/admin/users"))}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Usuarios
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user.role === "admin" && (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink sm:hidden"
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Usuarios
            </Link>
          )}

          <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs sm:flex">
            {user.role === "admin" && (
              <Shield
                className="h-3.5 w-3.5 text-stage"
                aria-label="Administrador"
              />
            )}
            <span className="font-medium text-ink">
              {user.display_name || user.username}
            </span>
            <span className="font-mono text-ink-muted">@{user.username}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {loggingOut ? "Saliendo..." : "Salir"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
