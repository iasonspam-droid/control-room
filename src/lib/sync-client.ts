"use client";

import type { SyncState } from "@/app/api/sync/route";

export type { SyncState };

export type PullResult =
  | { kind: "state"; state: SyncState; empty: boolean }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

/** GET the signed-in user's state. `empty` means a brand-new account. */
export async function pullState(): Promise<PullResult> {
  try {
    const res = await fetch("/api/sync", { cache: "no-store" });
    if (res.status === 401) return { kind: "unauthenticated" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        kind: "error",
        message: body.message ?? `Sync failed (${res.status}).`,
      };
    }
    const state = (await res.json()) as SyncState;
    // No categories is the reliable "never saved anything" signal — every
    // populated account has at least one, since tasks can't exist without one.
    const empty = !state.categories || state.categories.length === 0;
    return { kind: "state", state, empty };
  } catch {
    return { kind: "error", message: "Couldn't reach the server." };
  }
}

/** PUT the whole snapshot. Whole-state because the store already holds it all. */
export async function pushState(
  state: SyncState,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: "Signed out." };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message ?? `Save failed (${res.status}).` };
  } catch {
    return { ok: false, message: "Couldn't reach the server." };
  }
}
