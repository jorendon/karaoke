"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QueueItem } from "@/lib/database.types";

interface UseSessionQueueRealtimeOptions {
  sessionId: string;
  sessionCode: string;
  initialItems: QueueItem[];
  initialIsActive: boolean;
}

function sortQueueItems(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Suscripción Realtime a `queue_items` y `sessions` para sincronizar la cola
 * y el estado de la fiesta en vivo entre el anfitrión y todos los celulares.
 */
export function useSessionQueueRealtime({
  sessionId,
  sessionCode,
  initialItems,
  initialIsActive,
}: UseSessionQueueRealtimeOptions) {
  const [items, setItems] = useState<QueueItem[]>(() =>
    sortQueueItems(initialItems)
  );
  const [isActive, setIsActive] = useState<boolean>(initialIsActive);
  const [connected, setConnected] = useState<boolean>(false);

  const refreshQueue = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionCode}/queue`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        session?: { is_active: boolean };
        items?: QueueItem[];
      };
      if (data.items) {
        setItems(sortQueueItems(data.items));
      }
      if (typeof data.session?.is_active === "boolean") {
        setIsActive(data.session.is_active);
      }
    } catch {
      // Reintento silencioso en la próxima actualización
    }
  }, [sessionCode]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`karaoke-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_items",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const incoming = payload.new as QueueItem;
            setItems((prev) => {
              const filtered = prev.filter((item) => item.id !== incoming.id);
              return sortQueueItems([...filtered, incoming]);
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as QueueItem;
            setItems((prev) =>
              sortQueueItems(
                prev.map((item) => (item.id === updated.id ? updated : item))
              )
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setItems((prev) => prev.filter((item) => item.id !== deletedId));
            } else {
              void refreshQueue();
            }
          } else {
            void refreshQueue();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const nextActive = (payload.new as { is_active?: boolean })
            ?.is_active;
          if (typeof nextActive === "boolean") {
            setIsActive(nextActive);
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          void refreshQueue();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, refreshQueue]);

  const playingItem = items.find((item) => item.status === "playing") ?? null;
  const pendingItems = items.filter((item) => item.status === "pending");
  const historyItems = items
    .filter((item) => item.status === "played" || item.status === "skipped")
    .reverse();

  return {
    items,
    playingItem,
    pendingItems,
    historyItems,
    isActive,
    setIsActive,
    connected,
    refreshQueue,
  };
}
