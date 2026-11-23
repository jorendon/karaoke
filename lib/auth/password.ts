import "server-only";

import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

// Hash válido fijo usado para igualar tiempos cuando el usuario no existe
const DUMMY_BCRYPT_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEeO6W8xF5yP8p8p8p8p8p8p8p8p8p8p8pO";

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export async function verifyDummyPassword(
  plainPassword: string
): Promise<void> {
  await bcrypt.compare(plainPassword, DUMMY_BCRYPT_HASH).catch(() => false);
}
