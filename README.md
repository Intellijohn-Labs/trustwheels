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

## Migrating the backend to a self-hosted VPS (Supabase, Docker Compose)

Checklist for moving from managed Supabase to self-hosted Supabase on your own VPS. Zero app code
changes - the app only ever points at `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Step 1: Server setup

```bash
curl -fsSL https://get.docker.com | sh
sudo apt install -y docker-compose-plugin
docker compose version
```

### Step 2: Run the Supabase stack

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL
docker compose pull
docker compose up -d
```

Put a reverse proxy (Caddy/Nginx) with SSL in front of the Kong gateway (port `8000`), e.g.
`https://backend.yourcompany.com` -> `kong:8000`.

### Step 3: Database migration

```bash
# Export from the current managed Supabase project (this project's ref is tkmicqvpyddyichpejer -
# the database password isn't in any env file here; get it from Project Settings -> Database)
pg_dump "postgresql://postgres:<PASSWORD>@tkmicqvpyddyichpejer.supabase.co:5432/postgres" \
  --no-owner --no-privileges --schema=public -Fc -f trustwheels.dump

# Import into the new VPS Postgres
pg_restore -h localhost -p 5432 -U postgres -d postgres --no-owner --no-privileges trustwheels.dump

# Apply this repo's own migrations too (recreates RLS policies + the vehicle-media bucket)
for f in supabase/migrations/*.sql; do
  psql "postgresql://postgres:<PASSWORD>@localhost:5432/postgres" -f "$f"
done
```

### Step 4: Storage migration

```bash
mc alias set supa https://<PROJECT_REF>.supabase.co/storage/v1/s3 <OLD_S3_KEY> <OLD_S3_SECRET>
mc alias set vps https://backend.yourcompany.com/storage/v1/s3 <NEW_S3_KEY> <NEW_S3_SECRET>
mc mirror supa/vehicle-media vps/vehicle-media
```

(S3 credentials: Project Settings -> Storage -> S3 Connection, on both the old and new projects.)

### Step 5: Environment variables

Update `.env.local` (and wherever the app is deployed) with the new instance's values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://backend.yourcompany.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from Step 2's .env>
```

### Step 6: Verify & launch Next.js

```bash
pnpm install --frozen-lockfile
pnpm build
pm2 restart trustwheels || pm2 start pnpm --name trustwheels -- start
pm2 save
```

- [ ] Log in with an existing staff email/password
- [ ] Upload a vehicle photo or document and confirm it loads
- [ ] Open an existing vehicle and confirm its old photos/documents still load
