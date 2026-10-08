# Trust Wheels: stock UI

Front end only, for adding and browsing used two-wheeler stock. No backend yet: vehicles are saved in the browser (IndexedDB) through `src/lib/stock-store.ts`. That file is the one to replace with API calls when `apps/api` exists.

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

- `/stock`: stock list with search, branch filter, and lifecycle-stage filter
- `/stock/new`: Add stock form, designed for phones (camera capture, image compression, live registration check, duplicate warning)
- `/stock/[id]`: vehicle detail page with photos and the 12-stage lifecycle timeline

Branches, makes/models, photo slots and lifecycle stages are placeholders in `src/lib/masters.ts`.

---

## Migrating the backend from managed Supabase to a self-hosted VPS

This app talks to Supabase three ways, all from the browser via `@supabase/supabase-js` /
`@supabase/ssr` (`src/lib/supabase.ts`, `src/lib/supabase-server.ts`): **Postgres** (every table is
`{ id text primary key, data jsonb, created_at timestamptz }`, read/written through
`src/lib/collections.ts` and `src/lib/stock-store.ts`), **Auth** (email/password sign-in, password
reset), and **Storage** (the public `vehicle-media` bucket - vehicle photos, documents, and
employee avatars). A migration has to replace all three without the app noticing, since the code
never changes - it only ever points at `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Read this first: pick one of two paths

| | **Path A - self-host Supabase itself** | **Path B - raw PostgreSQL + MinIO** |
|---|---|---|
| App code changes needed | **None.** Same client, same API shape. | **Yes, out of scope here.** Raw Postgres has no REST/Auth/Storage API for a browser to call directly - `supabase.from(...)`, `supabase.auth.*` and `supabase.storage.*` throughout this codebase would all need a replacement backend layer. |
| What you're standing up | Supabase's own Docker Compose stack (Postgres + PostgREST + GoTrue + Storage API + Realtime + Studio) | Plain PostgreSQL and a MinIO/S3 bucket, nothing else |
| Recommended when | You just want the same app running against infrastructure you control | You're intentionally rearchitecting the backend, not just relocating it |

**Path A is the recommended route for this project** - it's a true lift-and-shift. Path B is
documented below because it was asked for, but treat it as a starting point for a larger
rearchitecture, not a drop-in replacement.

### 0. What actually needs to move

- **Database tables** (all in the `public` schema, each a `{id, data jsonb, created_at}` row store):
  `vehicles`, `leads`, `calls`, `campaigns`, `funds`, `hr_employees`, `ledger_entries`,
  `settlements`, `gps_attendance`, `activity_logs`. The exact DDL for all of them, plus RLS
  policies and the `vehicle-media` Storage bucket, is already captured as plain SQL in
  `supabase/migrations/0001` through `0006` - replaying those files against the new Postgres
  recreates the schema from scratch.
- **Storage objects**: everything under the `vehicle-media` bucket's `photos/`, `documents/` and
  `avatars/` prefixes (`src/lib/vehicle-media.ts`, `src/lib/employee-media.ts`).
- **Auth users**: whoever has signed in via email/password (Managing Partner and any other staff
  accounts). `scripts/reset-auth-passwords.mjs` already uses the Auth Admin API and works unchanged
  against a self-hosted GoTrue instance - just point its `SUPABASE_URL` at the new endpoint.

### 1. VPS prerequisites

- **Docker** and **Docker Compose v2** (`docker compose version`).
- A **reverse proxy with SSL** in front of both the app and the Supabase stack - Caddy is the
  simplest (automatic Let's Encrypt certs); Nginx + certbot works the same way with more setup.
- For Path A: no separate PostgreSQL install - Supabase's Compose stack provisions its own
  Postgres 15 container. Enable the `pgvector` extension in that Postgres image only if a future
  feature needs vector search; nothing in this app uses it today.
- For Path B: **PostgreSQL 15+** installed directly, and either **MinIO** (self-hosted,
  S3-compatible) or a plain mounted disk directory for files.
- Enough disk for the Postgres volume and the media bucket - check current usage first:
  `du -sh` on the Supabase project's Storage bucket, or `select pg_size_pretty(pg_database_size(current_database()));`
  against the current database.

### 2. Path A - self-hosting Supabase (recommended)

1. On the VPS, clone Supabase's official self-hosting Compose project and configure it (generates
   its own Postgres, GoTrue/Auth, PostgREST, Storage API and Studio containers, wired together):
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   cp .env.example .env
   # Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
   # SITE_URL (this app's deployed URL), and the SMTP_* vars (needed for password-reset emails).
   docker compose pull
   docker compose up -d
   ```
2. Put the reverse proxy in front of the stack's Kong gateway (default container port `8000`) with
   SSL, e.g. `https://backend.yourcompany.com` -> `kong:8000`.
3. Apply this project's schema against the new instance - either via the Supabase Studio SQL editor
   at `https://backend.yourcompany.com` (same manual process already used for every migration in
   this repo - see each file's own header comment) or directly with `psql`:
   ```bash
   for f in supabase/migrations/*.sql; do
     psql "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres" -f "$f"
   done
   ```
   This recreates every table, its RLS policies, and the `vehicle-media` bucket (migration `0002`)
   in one pass - nothing else to configure for Storage.
4. Copy the media files from the old bucket to the new one. The Supabase CLI's own storage
   migration helper is the simplest path (it talks the Storage API on both ends, so object
   metadata and content-types carry over correctly):
   ```bash
   npx supabase@latest login
   npx supabase@latest storage cp \
     --experimental \
     -r ss:///vehicle-media \
     ss:///vehicle-media \
     --linked                      # source: the managed project linked via `supabase link`
     # then re-run with --project-ref pointed at the new instance as the destination,
     # or use `rclone` (below) if the CLI's storage commands are unavailable in your version.
   ```
   If that subcommand isn't available, `rclone` works against any S3-compatible Storage API
   (self-hosted Supabase Storage included) and is the more reliable option in practice:
   ```bash
   rclone copy \
     ":s3,provider=Other,endpoint=https://<OLD_PROJECT>.supabase.co/storage/v1/s3,access_key_id=<OLD_S3_KEY>,secret_access_key=<OLD_S3_SECRET>:vehicle-media" \
     ":s3,provider=Other,endpoint=https://backend.yourcompany.com/storage/v1/s3,access_key_id=<NEW_S3_KEY>,secret_access_key=<NEW_S3_SECRET>:vehicle-media" \
     --progress
   ```
   (S3 credentials for Supabase Storage are generated under Project Settings -> Storage -> S3
   Connection on the managed project, and under the self-hosted Storage API's own config on the new one.)
5. Re-create Auth users on the new instance with `scripts/reset-auth-passwords.mjs`, pointed at the
   new project:
   ```bash
   SUPABASE_URL=https://backend.yourcompany.com \
   SUPABASE_SERVICE_ROLE_KEY=<new SERVICE_ROLE_KEY from step 1> \
   node scripts/reset-auth-passwords.mjs --emails=<comma-separated emails> --password="<temporary password>"
   ```
   Each person's `hr_employees` record only matches them by email (`resolveEmployeeForEmail` in
   `src/lib/auth.ts`), so as long as the email matches what's already in `hr_employees`, sign-in
   resolves correctly with no further data changes.
6. Update the app's environment variables (see §4) to point at the new instance and redeploy.

### 3. Path B - raw PostgreSQL + MinIO (manual, not a drop-in replacement)

Only the data-movement commands are covered here - see the table above for what this path does
**not** include (a REST/Auth/Storage API layer for the app to call).

**Database dump and restore:**
```bash
# From the managed Supabase project (connection string: Project Settings -> Database ->
# Connection string -> URI; use the "Session pooler" string if your network can't reach the
# direct connection port):
pg_dump "postgresql://postgres:<PASSWORD>@<PROJECT_REF>.supabase.co:5432/postgres" \
  --no-owner --no-privileges --schema=public -Fc -f trustwheels.dump

# On the VPS, against a freshly created database:
createdb -h localhost -U postgres trustwheels
pg_restore -h localhost -U postgres -d trustwheels --no-owner --no-privileges trustwheels.dump
```
If the Supabase CLI is linked to the project (`supabase link`), `supabase db dump -f trustwheels.sql`
is the equivalent one-liner and produces a plain `.sql` file restorable with `psql` instead of `pg_restore`.

**Storage migration to MinIO:**
```bash
# Start MinIO (persisted to a mounted volume) and create the bucket:
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=<minio_user> -e MINIO_ROOT_PASSWORD=<minio_password> \
  -v /srv/minio-data:/data minio/minio server /data --console-address ":9001"
mc alias set local http://localhost:9000 <minio_user> <minio_password>
mc mb local/vehicle-media

# Mirror every object out of the Supabase bucket, preserving the photos/ documents/ avatars/
# folder structure the app's upload helpers already use:
mc alias set supa https://<PROJECT_REF>.supabase.co/storage/v1/s3 <S3_KEY> <S3_SECRET>
mc mirror supa/vehicle-media local/vehicle-media
```
Whatever replaces the Storage API in this path must still return a stable public URL per
object - those URLs are the only thing saved onto each vehicle/document/employee record
(`uploadToBucket()` in `src/lib/vehicle-media.ts`, `uploadEmployeePhoto()` in
`src/lib/employee-media.ts`); rewriting them after the fact means updating every `data.photos` /
`data.documents` / `data.photoUrl` value already stored in Postgres to match.

### 4. Environment variables

The app itself only ever reads two: everything else below is server-side infrastructure config,
not something `src/` code touches.

| Variable | Where it's read | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts`, `src/lib/supabase-server.ts` | New backend's public URL - the Kong gateway's address (Path A) or your own API layer's address (Path B). Baked into the client bundle at build time - rebuild after changing it. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | The new instance's anon/publishable key. Also rebuild-time. |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `scripts/reset-auth-passwords.mjs` only (never shipped to the browser) | Used solely for the one-off Auth Admin API script; not read by the Next.js app itself. |
| `DATABASE_URL` | Only if you add server-side tooling that talks to Postgres directly (none exists in `src/` today - every current read/write goes through the Supabase client) | Format: `postgresql://<user>:<password>@<host>:<port>/<database>`; use the pooled/`pgbouncer` port for app traffic and the direct port for migrations/dumps if your self-hosted setup distinguishes them. |

### 5. Deploying the Next.js app on the VPS

The app currently deploys to Vercel (`VERCEL_OIDC_TOKEN` in `.env.local` is Vercel's own
build-time artifact). Moving the backend alone doesn't require moving the app too - Vercel can
keep serving the frontend against the new `NEXT_PUBLIC_SUPABASE_*` values. If the app is moving to
the same VPS as well:

**Option 1 - PM2 (simplest, no Dockerfile needed):**
```bash
pnpm install --frozen-lockfile
pnpm build
pm2 start pnpm --name trustwheels -- start   # runs `next start`, honors the PORT env var
pm2 save
```

**Option 2 - Docker Compose:** this repo has no `Dockerfile` yet; add `output: "standalone"` to
`next.config.ts` first (keeps the production image small), then build one, e.g.:
```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
ENV PORT=3000
CMD ["node", "server.js"]
```
Then `docker compose up -d --build` alongside the Supabase stack from §2, and point the reverse
proxy's app host (e.g. `https://app.yourcompany.com`) at this container's port `3000`.
