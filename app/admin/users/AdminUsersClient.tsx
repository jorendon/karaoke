"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import type { PublicAppUser, UserRole } from "@/lib/database.types";

interface AdminUsersClientProps {
  initialUsers: PublicAppUser[];
  currentUserId: string;
}

export function AdminUsersClient({
  initialUsers,
  currentUserId,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<PublicAppUser[]>(initialUsers);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("host");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          display_name: displayName,
          password,
          role,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        user?: PublicAppUser;
        error?: string;
      };

      if (!response.ok || !data.user) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo crear el usuario.",
        });
        return;
      }

      setUsers((prev) => [data.user!, ...prev]);
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("host");
      setFeedback({
        type: "success",
        text: `Usuario @${data.user.username} creado correctamente.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al crear el usuario.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(target: PublicAppUser) {
    setFeedback(null);
    setBusyId(target.id);

    try {
      const response = await fetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !target.is_active }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        user?: PublicAppUser;
        error?: string;
      };

      if (!response.ok || !data.user) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo actualizar el usuario.",
        });
        return;
      }

      setUsers((prev) =>
        prev.map((item) => (item.id === target.id ? data.user! : item))
      );
      setFeedback({
        type: "success",
        text: data.user.is_active
          ? `Usuario @${data.user.username} activado.`
          : `Usuario @${data.user.username} desactivado.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al actualizar el usuario.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(target: PublicAppUser) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente al usuario @${target.username}? También se eliminarán sus sesiones y playlists.`
    );
    if (!confirmed) return;

    setFeedback(null);
    setBusyId(target.id);

    try {
      const response = await fetch(`/api/admin/users/${target.id}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo eliminar el usuario.",
        });
        return;
      }

      setUsers((prev) => prev.filter((item) => item.id !== target.id));
      setFeedback({
        type: "success",
        text: `Usuario @${target.username} eliminado.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al eliminar el usuario.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-live/30 bg-live/10 text-live"
              : "border-ok/30 bg-ok/10 text-ok"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Formulario de creación */}
      <section
        aria-labelledby="create-user-heading"
        className="surface-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-2.5">
          <UserPlus className="h-5 w-5 text-stage" aria-hidden="true" />
          <h2 id="create-user-heading" className="text-lg font-semibold text-ink">
            Nuevo usuario anfitrión
          </h2>
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label
              htmlFor="new-username"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              Usuario *
            </label>
            <input
              id="new-username"
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. maria"
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            />
          </div>

          <div>
            <label
              htmlFor="new-display-name"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              Nombre visible
            </label>
            <input
              id="new-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ej. María López"
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              Contraseña (mín. 8) *
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            />
          </div>

          <div>
            <label
              htmlFor="new-role"
              className="block text-xs font-medium uppercase tracking-wider text-ink-secondary"
            >
              Rol
            </label>
            <select
              id="new-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-stage focus:outline-none focus:ring-2 focus:ring-stage/30"
            >
              <option value="host">Anfitrión (host)</option>
              <option value="admin">Administrador (admin)</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-stage px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-stage-hover disabled:opacity-60"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Crear usuario
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de usuarios */}
      <section
        aria-labelledby="users-list-heading"
        className="surface-card overflow-hidden rounded-2xl"
      >
        <div className="border-b border-white/10 px-6 py-4">
          <h2 id="users-list-heading" className="text-lg font-semibold text-ink">
            Usuarios registrados ({users.length})
          </h2>
        </div>

        {users.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-secondary">
            No hay usuarios registrados todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-canvas/50 text-xs uppercase tracking-wider text-ink-muted">
                  <th className="px-6 py-3.5 font-medium">Usuario</th>
                  <th className="px-6 py-3.5 font-medium">Rol</th>
                  <th className="px-6 py-3.5 font-medium">Estado</th>
                  <th className="px-6 py-3.5 font-medium">Creado</th>
                  <th className="px-6 py-3.5 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((item) => {
                  const isSelf = item.id === currentUserId;
                  const isBusy = busyId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-elevated/40"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-ink">
                          {item.display_name || item.username}
                          {isSelf && (
                            <span className="ml-2 rounded bg-elevated px-1.5 py-0.5 text-[11px] font-normal text-ink-secondary">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-ink-muted">
                          @{item.username}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {item.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-stage/15 px-2.5 py-1 text-xs font-medium text-stage">
                            <Shield className="h-3 w-3" aria-hidden="true" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-ink-secondary">
                            Anfitrión
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                            item.is_active
                              ? "bg-ok/15 text-ok"
                              : "bg-live/15 text-live"
                          }`}
                        >
                          {item.is_active ? "Activo" : "Desactivado"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-ink-secondary">
                        {new Date(item.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() => handleToggleActive(item)}
                            title={
                              isSelf
                                ? "No puedes desactivar tu propia cuenta"
                                : item.is_active
                                  ? "Desactivar usuario"
                                  : "Activar usuario"
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-white/20 hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {item.is_active ? (
                              <>
                                <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <UserCheck
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Activar
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() => handleDelete(item)}
                            title={
                              isSelf
                                ? "No puedes eliminar tu propia cuenta"
                                : "Eliminar usuario"
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-live/25 bg-live/10 px-3 py-1.5 text-xs font-medium text-live transition-colors hover:bg-live/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
