import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
// Imported for its side effect on module resolution: TypeScript only accepts the
// `declare module "next-auth/jwt"` augmentation below if the module is referenced.
import "next-auth/jwt";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { databaseConfigured, prisma } from "./db";

export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

const GOOGLE_SCOPES = `openid email profile ${GOOGLE_CALENDAR_SCOPE}`;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Refresh a little early so an in-flight Calendar call can't race the expiry. */
const EXPIRY_SKEW_SECONDS = 60;

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;

/**
 * Sign-in is an optional upgrade, not a prerequisite: the UI runs entirely on the
 * local zustand store until someone actually configures Google + Postgres. So we
 * assemble the config defensively and export a provider-less one when credentials
 * are missing — importing this module must never throw, or `next build` dies.
 */
export const authConfigured = Boolean(
  googleClientId && googleClientSecret && databaseConfigured,
);

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    /** Set when the stored refresh token no longer works — the UI must re-consent. */
    error?: "RefreshAccessTokenError";
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    /** Seconds since epoch, matching Google's own `expires_at` convention. */
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export type AccessTokenResult =
  | { ok: true; accessToken: string; scope: string }
  | { ok: false; reason: "not-connected" | "missing-scope" | "refresh-failed" };

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Exchange the stored refresh token for a fresh access token and write the result
 * back to the Account row. Google only hands out a refresh token on the first
 * consent (hence `prompt: "consent"` + `access_type: "offline"`), so the row is
 * the single source of truth — the JWT is just a cache of it.
 */
async function rotateGoogleAccessToken(
  accountId: string,
  refreshToken: string,
): Promise<GoogleTokenResponse | null> {
  if (!googleClientId || !googleClientSecret) return null;

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const tokens = (await response.json()) as GoogleTokenResponse;

  await prisma.account.update({
    where: { id: accountId },
    data: {
      access_token: tokens.access_token,
      expires_at: nowSeconds() + tokens.expires_in,
      // Google usually omits it on refresh; only overwrite when it actually rotates.
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    },
  });

  return tokens;
}

/**
 * The token accessor every server route should use: reads the Account row,
 * refreshes if the access token has expired, and reports *why* it can't produce
 * one so callers can return a useful error instead of a bare 500.
 */
export async function getGoogleAccessToken(
  userId: string,
): Promise<AccessTokenResult> {
  if (!authConfigured) return { ok: false, reason: "not-connected" };

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });

  if (!account) return { ok: false, reason: "not-connected" };

  const scope = account.scope ?? "";
  if (!scope.includes(GOOGLE_CALENDAR_SCOPE)) {
    return { ok: false, reason: "missing-scope" };
  }

  const stillValid =
    account.access_token &&
    account.expires_at &&
    account.expires_at - EXPIRY_SKEW_SECONDS > nowSeconds();

  if (stillValid && account.access_token) {
    return { ok: true, accessToken: account.access_token, scope };
  }

  if (!account.refresh_token) return { ok: false, reason: "refresh-failed" };

  const tokens = await rotateGoogleAccessToken(account.id, account.refresh_token);
  if (!tokens) return { ok: false, reason: "refresh-failed" };

  return { ok: true, accessToken: tokens.access_token, scope: tokens.scope ?? scope };
}

export const authConfig: NextAuthConfig = {
  // The adapter is only ever touched inside a request, so wiring it up without a
  // database would be harmless — but skipping it keeps the failure mode obvious.
  ...(databaseConfigured ? { adapter: PrismaAdapter(prisma) as Adapter } : {}),
  providers: authConfigured
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          authorization: {
            params: {
              scope: GOOGLE_SCOPES,
              access_type: "offline",
              prompt: "consent",
            },
          },
          // Google is the only provider, so linking by verified email is safe and
          // spares the user a dead-end "account not linked" screen.
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],
  // JWT rather than database sessions: route handlers then need one DB round trip
  // (the Account row) instead of two, and the session survives a DB hiccup.
  //
  // 90 days, rolling: `updateAge` re-issues the token once a day of use, so
  // anyone opening this weekly effectively never signs in again. Opting *out*
  // ("keep me signed in" unchecked) is handled in middleware.ts, which strips
  // the cookie's expiry so it dies with the browser — a per-login lifetime is
  // not something Auth.js can express in this config alone.
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    // With no provider there is no way to sign in and therefore no session to
    // protect, so a placeholder is safe here and keeps /api/auth/* answering 200
    // instead of 500 on a fresh checkout. Once Google *is* configured, a missing
    // secret is a real misconfiguration and Auth.js should say so loudly.
    (authConfigured ? undefined : "control-room-unconfigured-placeholder"),
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) token.userId = user.id;

      // First sign-in: the adapter has just written the Account row, so cache the
      // freshly issued token rather than immediately reading it back.
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.expiresAt =
          typeof account.expires_at === "number"
            ? account.expires_at
            : nowSeconds() + 3600;
        return token;
      }

      const unexpired =
        token.expiresAt && token.expiresAt - EXPIRY_SKEW_SECONDS > nowSeconds();
      if (unexpired || !token.userId) return token;

      try {
        const refreshed = await getGoogleAccessToken(token.userId);
        if (refreshed.ok) {
          token.accessToken = refreshed.accessToken;
          token.expiresAt = nowSeconds() + 3600;
          delete token.error;
        } else if (refreshed.reason === "refresh-failed") {
          token.error = "RefreshAccessTokenError";
        }
      } catch {
        // A database blip must not sign the user out; the next call retries.
      }

      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
