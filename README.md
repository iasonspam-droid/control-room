# Control Room

A time-management app that treats your week as an instrument panel: hours
banked against per-category targets, blocks written to your real Google
Calendar, and XP weighted so the important-but-not-urgent work pays best.

Six screens — **Today**, **Week**, **Matrix**, **Log**, **Recap**, **Settings** —
plus a landing page. Keyboard `1`–`5` jumps between the first five.

Design system and the reasoning behind it: [`DESIGN.md`](./DESIGN.md).

---

## Run it now

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. It works immediately with **no environment
variables at all** — the whole app runs client-side against a seeded store in
`localStorage`, so you can use it as a real planner today and add the backend
whenever you want. Settings → *Reset local data* restores the sample week.

---

## What's wired

| Layer | State |
|---|---|
| UI, all six screens | Done, fully interactive |
| XP / levels / streaks / rings | Done, computed live |
| Local persistence | Done (`localStorage`, zustand `persist`) |
| Browser reminders | Done — foreground, permission asked in Settings |
| Prisma schema (Postgres) | Written, not yet the source of truth for the UI |
| NextAuth + Google OAuth | Written, degrades to signed-out with no credentials |
| Calendar create / move / delete | Written (`/api/calendar/events`) |
| Sync endpoint | Written (`/api/sync`) — the store still reads `localStorage` |

The last four are inert until you set the env vars below. Nothing 500s without
them; the API routes return `401`/`503` JSON and the pages carry on.

---

## Going live

### 1. Database — Supabase

Create a project, then from **Settings → Database** take both connection
strings:

```
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...supabase.com:5432/postgres"
```

Then push the schema:

```bash
npm run db:push
```

`DATABASE_URL` is the pooled connection used at runtime; `DIRECT_URL` is the
direct one Prisma needs for migrations. Both are required — that's a Supabase
constraint, not a quirk of this app.

### 2. Google OAuth

In Google Cloud Console:

1. Create a project, enable the **Google Calendar API**.
2. **OAuth consent screen** → External → add yourself as a test user.
3. **Credentials → OAuth client ID → Web application**.
4. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-app>.vercel.app/api/auth/callback/google`

Scopes requested: `openid email profile` plus
`https://www.googleapis.com/auth/calendar.events`. Nothing else is read, and no
event this app didn't create is ever modified.

### 3. Environment

Copy `.env.example` to `.env.local` and fill it in. Generate the secret with
`openssl rand -base64 32`.

```
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 4. Vercel

Import the repo, add the same variables (with `AUTH_URL` set to the production
URL), deploy. The free tier covers this comfortably — everything is static or a
short-lived route handler.

---

## Design decisions worth knowing

**Q2 pays 1.5×, more than Q1.** Urgent-and-important work already rewards
itself with relief. The only work a score can usefully bribe you toward is the
important thing that isn't screaming yet, so that's where the multiplier goes.
Q3 is 0.6×, Q4 is 0.3×.

**Completion is never written back to Google Calendar.** Booking a block
creates an event; moving it updates the event; deleting it removes the event.
But by the time you tick something off, that slot has already passed — writing
"done" back would add noise to a calendar you share with other people, for no
benefit. Completion lives in the app.

**Levels are cosmetic and always will be.** No feature is gated behind XP.
The moment a level unlocks something, the score stops measuring your week and
starts distorting it.

**Streaks have two grace days a week.** A streak that breaks the first time
life happens teaches you to stop looking at the app. Two freezes is enough to
survive a bad week and few enough that the number still means something.

**Everything is warm black with one accent.** See `DESIGN.md` — the short
version is that amber means *energy in motion* (now, live, due) and cyan means
*banked* (done, logged, in the bank). Nothing else gets a colour unless it's a
category swatch, which is functional.

---

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · zustand · date-fns ·
Lucide · Prisma + Postgres (Supabase) · NextAuth v5 · Vercel.

Fonts (Archivo, JetBrains Mono) are self-hosted in `src/fonts` — no request
leaves the page to render type.
