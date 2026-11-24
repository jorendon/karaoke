import type { QueueItem } from "@/lib/database.types";

/**
 * Normaliza el nombre del cantante para evitar duplicar turnos por mayúsculas
 * o espacios (ej. "Jonathan" vs "jonathan ").
 */
export function normalizeSingerName(name: string | null | undefined): string {
  return (name || "invitado").trim().toLowerCase() || "invitado";
}

/**
 * Calcula el índice justo (turnos rotativos / round-robin) donde debe entrar
 * una nueva canción dentro de los items `pending`, evitando que una persona
 * que agregó varias canciones seguidas acapare la fila cuando llegan otros.
 *
 * Ejemplo:
 * - Si Jonathan agregó 3 canciones [J1, J2, J3] y luego llega María (M1) y Carlos (C1):
 *   -> Si J1 está sonando (`playing`), el orden pendiente queda: [M1, C1, J2, J3].
 *   -> Si nadie está sonando aún, queda: [J1, M1, C1, J2, J3].
 * - Si María agrega una 2da canción (M2): entra en la ronda 2 -> [M1, C1, J2, M2, J3].
 */
export function computeFairInsertIndex(
  playingItem: Pick<QueueItem, "requested_by"> | null,
  pendingItems: Array<Pick<QueueItem, "requested_by">>,
  incomingRequestedBy: string | null | undefined
): number {
  if (pendingItems.length === 0) return 0;

  const singerRoundCount = new Map<string, number>();

  // Si alguien ya está cantando ahora, ya consumió su turno de la ronda actual
  if (playingItem) {
    const playingSinger = normalizeSingerName(playingItem.requested_by);
    singerRoundCount.set(playingSinger, 1);
  }

  const pendingRounds: number[] = pendingItems.map((item) => {
    const singer = normalizeSingerName(item.requested_by);
    const nextRound = (singerRoundCount.get(singer) ?? 0) + 1;
    singerRoundCount.set(singer, nextRound);
    return nextRound;
  });

  const incomingSinger = normalizeSingerName(incomingRequestedBy);
  const incomingRound = (singerRoundCount.get(incomingSinger) ?? 0) + 1;

  // Insertar justo antes de la primera canción que pertenezca a una ronda posterior
  const firstLaterRoundIdx = pendingRounds.findIndex(
    (round) => round > incomingRound
  );

  if (firstLaterRoundIdx === -1) {
    return pendingItems.length;
  }

  return firstLaterRoundIdx;
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Mezcla aleatoriamente las canciones pendientes POR RONDAS de cantantes,
 * garantizando que:
 * 1. Todos los cantantes presentes tengan su turno en la ronda 1 antes de
 *    que alguien repita en la ronda 2, etc.
 * 2. El orden dentro de cada ronda sea aleatorio.
 * 3. Nunca queden dos canciones seguidas de la misma persona si hay otros
 *    cantantes disponibles (incluso respecto a la canción que suena ahora).
 */
export function computeFairShuffledOrder<T extends Pick<QueueItem, "requested_by">>(
  playingItem: Pick<QueueItem, "requested_by"> | null,
  pendingItems: T[]
): T[] {
  if (pendingItems.length <= 1) return [...pendingItems];

  const bySinger = new Map<string, T[]>();
  for (const item of pendingItems) {
    const singer = normalizeSingerName(item.requested_by);
    const list = bySinger.get(singer) ?? [];
    list.push(item);
    bySinger.set(singer, list);
  }

  let maxSongsPerSinger = 0;
  for (const list of bySinger.values()) {
    if (list.length > maxSongsPerSinger) {
      maxSongsPerSinger = list.length;
    }
  }

  const result: T[] = [];
  let previousSinger = playingItem
    ? normalizeSingerName(playingItem.requested_by)
    : null;

  for (let roundIdx = 0; roundIdx < maxSongsPerSinger; roundIdx++) {
    const roundItems: T[] = [];
    for (const list of bySinger.values()) {
      if (list[roundIdx]) {
        roundItems.push(list[roundIdx]);
      }
    }

    const shuffled = fisherYatesShuffle(roundItems);

    // Evitar repetir el mismo cantante en el borde entre rondas o respecto al playing actual
    if (
      previousSinger &&
      shuffled.length > 1 &&
      normalizeSingerName(shuffled[0].requested_by) === previousSinger
    ) {
      const swapIdx = shuffled.findIndex(
        (item, idx) =>
          idx > 0 && normalizeSingerName(item.requested_by) !== previousSinger
      );
      if (swapIdx > 0) {
        const tmp = shuffled[0];
        shuffled[0] = shuffled[swapIdx];
        shuffled[swapIdx] = tmp;
      }
    }

    for (const item of shuffled) {
      result.push(item);
      previousSinger = normalizeSingerName(item.requested_by);
    }
  }

  return result;
}
