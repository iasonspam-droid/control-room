"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/lib/store";
import { pullState, pushState, type SyncState } from "@/lib/sync-client";
import { buildStarter } from "@/lib/starter";

const SAVE_DEBOUNCE_MS = 1200;

function snapshot(): SyncState {
  const s = useStore.getState();
  return {
    categories: s.categories,
    tasks: s.tasks,
    goals: s.goals,
    log: s.log,
    profile: s.profile,
    streak: s.streak,
    xp: s.xp,
    events: s.events,
  };
}

/**
 * Binds the local store to the signed-in user's server state.
 *
 * Load once on sign-in, then write back on every change, debounced. Reads are
 * authoritative on arrival — whatever was in this browser is discarded — because
 * the alternative is silently merging two people's weeks on a shared machine.
 */
export function CloudSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  const adoptRemote = useStore((s) => s.adoptRemote);
  const releaseRemote = useStore((s) => s.releaseRemote);
  const setSync = useStore((s) => s.setSync);

  const loadedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  /* ── load ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (status === "loading") return;

    if (!userId) {
      // Signed out (or never signed in): fall back to the local demo, but only
      // if we were previously holding someone's account data.
      if (loadedFor.current !== null) {
        loadedFor.current = null;
        releaseRemote();
      }
      return;
    }

    if (loadedFor.current === userId) return;
    loadedFor.current = userId;

    let cancelled = false;
    setSync("loading");

    void (async () => {
      const result = await pullState();
      if (cancelled) return;

      if (result.kind === "state") {
        if (result.empty) {
          // Brand-new account: give them a clean board with neutral categories,
          // not the demo user's coursework, then persist it so the next device
          // sees the same thing.
          const starter = buildStarter(session?.user?.name ?? null);
          adoptRemote(userId, starter);
          const saved = await pushState(snapshot());
          if (!cancelled) {
            setSync(saved.ok ? "idle" : "error", saved.message);
          }
        } else {
          adoptRemote(userId, {
            categories: result.state.categories,
            tasks: result.state.tasks,
            goals: result.state.goals,
            log: result.state.log,
            profile: result.state.profile,
            streak: result.state.streak,
            xp: result.state.xp,
            events: result.state.events ?? [],
          });
          setSync("idle");
        }
        return;
      }

      if (result.kind === "unauthenticated") {
        loadedFor.current = null;
        releaseRemote();
        return;
      }

      setSync("error", result.message);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, status, adoptRemote, releaseRemote, setSync, session?.user?.name]);

  /* ── save ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!userId) return;

    async function flush() {
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      inFlight.current = true;
      setSync("saving");
      const result = await pushState(snapshot());
      inFlight.current = false;
      setSync(result.ok ? "idle" : "error", result.message);
      if (queued.current) {
        queued.current = false;
        void flush();
      }
    }

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.mode !== "cloud" || state.ownerId !== userId) return;
      // Ignore pure sync-status churn, or we'd loop forever.
      if (
        state.categories === prev.categories &&
        state.tasks === prev.tasks &&
        state.goals === prev.goals &&
        state.log === prev.log &&
        state.profile === prev.profile &&
        state.streak === prev.streak &&
        state.xp === prev.xp &&
        state.events === prev.events
      ) {
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId, setSync]);

  /* Last-ditch save when the tab is hidden mid-debounce. `keepalive` lets the
     request outlive the page; sendBeacon can't be used here because it only
     issues POST and /api/sync takes PUT. */
  useEffect(() => {
    if (!userId) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (useStore.getState().mode !== "cloud") return;
      void fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot()),
        keepalive: true,
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [userId]);

  return null;
}
