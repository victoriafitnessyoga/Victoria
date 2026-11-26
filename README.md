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

The build copies `index.html`, `assets/`, and `public/` into `dist/`.
`public/` holds `robots.txt`, `sitemap.xml`, `llms.txt`, the 404 page, and the favicon.
`src/worker.mjs` runs before static assets and 301-redirects `victoriafitness.vn`
to `https://www.victoriafitness.vn`. If that redirect logic throws, the worker
serves the static asset anyway. A missing path returns `404.html`.

Form submissions still post directly to the existing Google Apps Script webhook.
Attribution documentation and UTM templates are in `TRACKING.md`; the Apps Script
source is in `integrations/`.

Run attribution/form checks with `node --test tests/lead-attribution.test.cjs`.
The backend uses no-cors submissions, so verify a row in the Google Sheet to
confirm a real submission was saved.

Do not commit credentials, Google/Meta/TikTok access tokens, or `.env` files.
