import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

/**
 * Auth.js's own handlers, wrapped so an initialisation failure returns a
 * readable message instead of an opaque 500. Auth.js catches very little at
 * this layer, and Vercel's request log records the status but not the throw,
 * which makes a misconfigured deployment near-undebuggable from outside.
 */

function describe(error: unknown) {
  const e = error as { name?: string; message?: string; stack?: string } | null;
  return {
    error: "auth_handler_failed",
    name: e?.name ?? typeof error,
    // Prisma and Auth.js both put the actionable part in `message`.
    message: e?.message ?? String(error),
    // First few frames only: enough to place the failure, short enough to read.
    stack: e?.stack?.split("\n").slice(0, 6).join("\n") ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    return await handlers.GET(request);
  } catch (error) {
    return Response.json(describe(error), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlers.POST(request);
  } catch (error) {
    return Response.json(describe(error), { status: 500 });
  }
}
