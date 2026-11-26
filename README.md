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

`POST /api/lead` on the worker forwards to the existing Google Apps Script webhook
and returns `{ok:true}` when the script confirms the row, or when the script
returns HTTP 200 with a body that is not JSON. Other failures stay failures so
the page does not claim success. The browser fires Meta `Lead` only after that
response. Attribution documentation is in `TRACKING.md`. Redeploy the current
Apps Script (same URL) so the sheet gains an `event_id` column.

Run attribution/form checks with `node --test tests/lead-attribution.test.cjs`.
Verify a real submission against a row in the Google Sheet. The success
message on the page is shown only after `/api/lead` returns `{ok:true}`.

Do not commit credentials, Google/Meta/TikTok access tokens, or `.env` files.
