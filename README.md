# Victoria Fitness landing page

Production: https://www.victoriafitness.vn/

Edit `index.html` and files in `assets/`, then commit to `main`.

Cloudflare watches `main` and automatically builds and deploys new commits.
Check the build status before considering a website update published.

Cloudflare Workers Builds configuration:

- Repository: `victoriafitnessyoga/Victoria`
- Production branch: `main`
- Build command: `node scripts/build-cloudflare.mjs`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Worker: `rough-night-ed55`
- Static output: `dist/` (generated; do not edit manually)

The build copies `index.html`, `assets/`, and `public/` into `dist/`. `public/`
holds `robots.txt`, `sitemap.xml`, the privacy page, the 404 page, and the favicon.
`src/worker.mjs` runs before static assets: it 301-redirects `victoriafitness.vn`
to `https://www.victoriafitness.vn`, and it proxies `POST /api/lead` to the
existing Google Apps Script webhook so the browser can see a real success or
failure. Other requests are served from `dist/`, and a missing path returns
`404.html`.

Form fields still go to that same Apps Script URL. Attribution documentation and
UTM templates are in `TRACKING.md`; the Apps Script source is in `integrations/`.
Redeploy that script on the current deployment (do not create a new URL) so the
sheet gains an `event_id` column. Until that redeploy, the proxy still saves the
existing columns and only the new id is dropped.

Do not deploy this branch onto the production worker. Cloudflare publishes `main`.

Run attribution/form checks with `node --test tests/lead-attribution.test.cjs`.
The backend uses no-cors submissions, so verify a row in the Google Sheet to
confirm a real submission was saved.

Do not commit credentials, Google/Meta/TikTok access tokens, or `.env` files.
