import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";

/**
 * Lets client components tell "signed out" apart from "sign-in was never set
 * up" — without that distinction the Settings screen offers a Connect button
 * that can only ever land on NextAuth's configuration error page.
 *
 * Every flag is computed per request, never at module scope: variables marked
 * Sensitive on Vercel are withheld from the build and only injected at runtime,
 * so a build-time constant would report "unconfigured" forever.
 */
export const dynamic = "force-dynamic";

// TEMPORARY — remove once the Vercel env var mystery is solved. Reports only
// presence (true/false) per variable name, never the values, so this is safe
// to leave publicly reachable for the few minutes it takes to diagnose.
function debugPresence() {
  const keys = [
    "DATABASE_URL",
    "DIRECT_URL",
    "AUTH_URL",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "AUTH_GOOGLE_ID",
    "GOOGLE_CLIENT_SECRET",
    "AUTH_GOOGLE_SECRET",
  ] as const;
  const presence: Record<string, boolean> = {};
  for (const k of keys) presence[k] = Boolean(process.env[k]);
  return {
    presence,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  };
}

export function GET() {
  return NextResponse.json({
    authConfigured: authConfigured(),
    databaseConfigured: databaseConfigured(),
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
    ),
    debug: debugPresence(),
  });
}
