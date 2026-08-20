import { PrismaClient } from "@prisma/client";

/**
 * The app has to boot and build with zero credentials configured, so the client
 * is never constructed at import time — `new PrismaClient()` throws when
 * DATABASE_URL is absent. Everything goes through the lazy proxy below, which
 * only instantiates on first real property access (i.e. an actual query).
 */

declare global {
  // Survives HMR in dev, where module state is thrown away but globals are not.
  var __controlRoomPrisma: PrismaClient | undefined;
}

/**
 * Read at call time, never captured in a module-level const.
 *
 * Vercel withholds variables marked "Sensitive" from the build step and only
 * injects them at runtime. A `const x = Boolean(process.env.DATABASE_URL)`
 * therefore evaluates during the build, folds to `false`, and stays false
 * forever — while `process.env.DATABASE_URL` is perfectly readable when a
 * request actually arrives. Every configuration check has to be a function.
 */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma(): PrismaClient {
  if (!databaseConfigured()) {
    throw new Error("DATABASE_URL is not set — persistence is disabled.");
  }
  globalThis.__controlRoomPrisma ??= new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return globalThis.__controlRoomPrisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma() as unknown as Record<string | symbol, unknown>;
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
