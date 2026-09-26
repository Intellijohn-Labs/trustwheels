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
