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

export function GET() {
  return NextResponse.json({
    authConfigured: authConfigured(),
    databaseConfigured: databaseConfigured(),
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
    ),
  });
}
