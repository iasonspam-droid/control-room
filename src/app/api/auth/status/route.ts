import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";

/**
 * Lets client components tell "signed out" apart from "sign-in was never set
 * up" — without that distinction the Settings screen offers a Connect button
 * that can only ever land on NextAuth's configuration error page.
 */

const EXPECTED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

// Anything the platform itself sets. Whatever is left over should be exactly
// the variables configured in the dashboard.
const PLATFORM_KEY =
  /^(VERCEL|AWS|LAMBDA|NEXT|NODE|npm|PATH$|HOME$|LANG|LC_|LD_|TZ$|PWD$|SHLVL$|HOSTNAME$|TERM|_$|__|EDGE_|LOG_|LS_COLORS|LESS)/;

export const dynamic = "force-dynamic";

export function GET() {
  const keys = Object.keys(process.env);

  return NextResponse.json({
    authConfigured,
    databaseConfigured,
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    diagnostics: {
      // Static, literal property access — not a computed lookup — so this is
      // immune to any build-time inlining that a dynamic key would defeat.
      staticProbe: {
        DATABASE_URL: typeof process.env.DATABASE_URL,
        AUTH_SECRET: typeof process.env.AUTH_SECRET,
        GOOGLE_CLIENT_ID: typeof process.env.GOOGLE_CLIENT_ID,
      },
      present: EXPECTED.filter((k) => (process.env[k] ?? "").length > 0),
      /**
       * Key names only — never values. JSON-quoted so that a trailing space or
       * a stray zero-width character in a pasted key name becomes visible,
       * which the dashboard's own rendering would hide completely.
       */
      nonPlatformKeys: keys
        .filter((k) => !PLATFORM_KEY.test(k))
        .map((k) => JSON.stringify(k))
        .sort(),
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      totalEnvKeys: keys.length,
    },
  });
}
