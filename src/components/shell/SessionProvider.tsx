"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * Thin client wrapper so the root layout — a server component — can fetch the
 * session once with `auth()` and hand it down, instead of every client
 * component doing its own round trip to /api/auth/session on mount.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
