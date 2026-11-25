# StudyCircle

**Learn together. Grow together.**

StudyCircle is a college project for students aged 18 and over. Find a peer who understands a difficult topic, study in a shared focus room and manage academic work in a private planner.

## Start the classroom tour

Install Node.js 24, run `npm ci`, then run `npm run dev`. Open the localhost address printed by Vite. With no Supabase configuration, StudyCircle opens a labelled fictional workspace. Use the student selector to rehearse both sides of a request, a study room or a moderation case. The tour resets on refresh.

See [DEMO_GUIDE.md](DEMO_GUIDE.md) for six scenarios and [PRESENTATION.md](PRESENTATION.md) for faculty discussion.

## Run with Supabase

The application uses React, Vite, TypeScript, Tailwind CSS, React Router, Framer Motion, Lucide, Recharts and KaTeX. Supabase provides PostgreSQL, Authentication, Storage and Realtime. SQL migrations authorize access and implement shared transitions.

1. Install Supabase CLI 3.4.0 and a Docker-compatible runtime. Start the container runtime.
2. Run `supabase start` at the repository root. It applies the migrations and loads local-only fictional fixtures from `supabase/seed.sql`. Run `supabase status` to view the local API, public client key and mailbox URL.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` to the local API URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to the local publishable or anon key.
4. Run `npm run dev` and use the `127.0.0.1` address. Local Auth redirects cover ports 5173 and 4173. Update the allowlist when choosing a different origin.
5. Register with the 18+ attestation. Open the local mail viewer (usually `http://127.0.0.1:54324`) and open the confirmation link in the registration browser. Repeat in a second browser profile with another account. The mailbox also captures recovery emails.
6. For faster rehearsals, sign in to two browser profiles with the local Maya and Ishaan fixtures from the demo guide.
7. Apply future local migrations with `supabase migration up`. Running `supabase db reset` recreates the local database and deletes local changes.

If the CLI does not serve the Edge Functions at startup, run `supabase functions serve --no-verify-jwt` in a second terminal. Each function validates the JWT and scopes operations before using its server credentials. [Supabase local development guide](https://supabase.com/docs/guides/local-development)

## Verify

```text
npm run check
npm test
npm run test:db
npx playwright install chromium
npm run e2e
npm run build
node tests/e2e/pwa.mjs
```

The database suite applies every migration to PGlite PostgreSQL and verifies workflows and RLS using a minimal platform contract. The default browser suite covers the isolated tour. With local Supabase running, set `E2E_SUPABASE_URL`, `E2E_SUPABASE_KEY` and `E2E_SUPABASE_SERVICE_KEY` to run the platform integration spec instead. The service key belongs only in the local test process. The test confirms email addresses via the local service API. Use the mail viewer for actual link delivery and password recovery checks. The app and Supabase tests run as separate CI jobs.

## Publish after approval

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for hosted Supabase, environment variables, migration deployment, staff bootstrap and the manual GitHub Pages workflow. The production build uses relative asset paths and hash routing. On supported browsers choose **Install StudyCircle** or **Add to Home Screen**. The installed app shows a fallback when disconnected.

See [DATABASE.md](DATABASE.md), [SECURITY.md](SECURITY.md), [TASKS.md](TASKS.md) and [docs/ROADMAP.md](docs/ROADMAP.md) for project details and remaining limits.
