"use client";

import { useState } from "react";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Checked (the default) is just the app's normal 90-day rolling session, so
 * nothing needs setting. Unchecked writes `cr.persist=0`, which middleware.ts
 * turns into a browser-session cookie — the point being a school or shared
 * machine where "stay signed in" is the wrong default.
 */
export function SignInButton() {
  const [stay, setStay] = useState(true);

  function go() {
    document.cookie = stay
      ? `cr.persist=; path=/; max-age=0; samesite=lax`
      : `cr.persist=0; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    window.location.href = "/api/auth/signin";
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={go} className="btn btn-signal self-start !px-5 !py-3">
        Sign in with Google
      </button>
      <label className="flex cursor-pointer items-center gap-2 text-[12px] text-dim select-none">
        <input
          type="checkbox"
          checked={stay}
          onChange={(e) => setStay(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-signal)]"
        />
        Keep me signed in on this device
      </label>
      {!stay && (
        <p className="max-w-[38ch] font-mono text-[10px] leading-relaxed text-mute">
          you&rsquo;ll be signed out when you close the browser
        </p>
      )}
    </div>
  );
}
