const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("homepage SEO tags use only published locations", () => {
  assert.match(html, /<title>Phòng gym &amp; yoga Bình Thạnh, Quận 1 \| Victoria Fitness<\/title>/);
  assert.match(html, /<h1 id="hero-title">[\s\S]*Phòng gym &amp; yoga[\s\S]*Bình Thạnh &amp; Quận 1/);
  assert.match(html, /Tập luyện bền vững bắt đầu từ một lựa chọn đúng/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.victoriafitness\.vn\/"/);
  assert.match(html, /property="og:image" content="https:\/\/www\.victoriafitness\.vn\/assets\/victoria-boxing-kettlebell-hero\.jpg"/);
  assert.match(html, /property="og:url" content="https:\/\/www\.victoriafitness\.vn\/"/);
  assert.match(html, /1445114913415739/);
  assert.match(html, /DB0G8JJC77U5SC4FO7I0/);
  assert.match(html, /9\.420\.000/);
  assert.match(html, /28\.600\.000/);
  assert.equal(html.includes("7.700.000"), false);
  assert.match(html, /type="application\/ld\+json"/);
  assert.equal((html.match(/"@type": "Question"/g) || []).length, 7);
  assert.match(html, /"@type": \[\s*"HealthClub",\s*"ExerciseGym"/);
  assert.match(html, /213\/16 Nguyễn Gia Trí, P\.25/);
  assert.equal(html.includes("/api/lead"), false);
});

test("worker redirects apex and fails open to assets", async () => {
  const { handle } = await import("../src/worker.mjs");
  const seen = [];
  const env = { ASSETS: { async fetch(request) { seen.push(new URL(request.url).pathname); return new Response("asset", { status: 200 }); } } };
  const apex = await handle(new Request("http://victoriafitness.vn/bang-gia?utm_source=fb#dang-ky"), env);
  assert.equal(apex.status, 301);
  assert.equal(apex.headers.get("location"), "https://www.victoriafitness.vn/bang-gia?utm_source=fb#dang-ky");
  const home = await handle(new Request("https://www.victoriafitness.vn/"), env);
  assert.equal(home.status, 200);
  assert.equal(seen.at(-1), "/");
  const broken = await handle(new Request("https://www.victoriafitness.vn/yoga"), env, () => { throw new Error("redirect bug"); });
  assert.equal(broken.status, 200);
  assert.equal(await broken.text(), "asset");
  assert.equal(seen.at(-1), "/yoga");
});

test("public SEO files", () => {
  const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  const llms = fs.readFileSync(path.join(root, "public/llms.txt"), "utf8");
  const missing = fs.readFileSync(path.join(root, "public/404.html"), "utf8");
  assert.match(robots, /Sitemap: https:\/\/www\.victoriafitness\.vn\/sitemap\.xml/);
  assert.match(robots, /content signals/);
  assert.match(sitemap, /<loc>https:\/\/www\.victoriafitness\.vn\/<\/loc>/);
  assert.match(llms, /213\/16 Nguyễn Gia Trí/);
  assert.match(llms, /9\.420\.000đ/);
  assert.match(llms, /28\.600\.000đ/);
  assert.match(llms, /1900 299 991/);
  assert.match(missing, /Về trang chủ/);
  assert.equal(fs.existsSync(path.join(root, "public/favicon.ico")), true);
  const config = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  assert.match(config, /"name": "rough-night-ed55"/);
  assert.match(config, /"run_worker_first": true/);
  assert.match(config, /"not_found_handling": "404-page"/);
});
