import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";

/**
 * Lets client components tell "signed out" apart from "sign-in was never set
 * up" — without that distinction the Settings screen offers a Connect button
 * that can only ever land on NextAuth's configuration error page.
 */

// Names only, never values: enough to diagnose a misconfigured deployment
// without putting a secret in an unauthenticated response.
const EXPECTED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
] as const;

// Env vars are read when the serverless function cold-starts, so a value that
// appears here but not in `authConfigured` would mean a stale module — worth
// being able to tell those apart.
export const dynamic = "force-dynamic";

export function GET() {
  const present = EXPECTED.filter((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0;
  });

  return NextResponse.json({
    authConfigured,
    databaseConfigured,
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
    ),
    diagnostics: {
      present,
      missing: EXPECTED.filter((k) => !present.includes(k)),
      // Confirms which build is answering, and in which Vercel environment.
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      // If this is 0-ish, nothing at all is reaching the runtime.
      totalEnvKeys: Object.keys(process.env).length,
    },
  });
}
