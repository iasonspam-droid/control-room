import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";

/**
 * Lets client components tell "signed out" apart from "sign-in was never set
 * up" — without that distinction the Settings screen offers a Connect button
 * that can only ever land on NextAuth's configuration error page.
 */
export function GET() {
  return NextResponse.json({
    authConfigured,
    databaseConfigured,
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
    ),
  });
}
