const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("images use responsive formats and fonts are self-hosted", () => {
  assert.equal(html.includes("fonts.googleapis.com"), false);
  assert.match(html, /<picture><source type="image\/avif"/);
  assert.match(html, /assets\/fonts\/victoria-00\.woff2/);
  assert.match(html, /rel="preload" as="image" type="image\/avif"/);
  assert.match(html, /rel="preload" as="font"/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "assets/responsive/victoria-boxing-kettlebell-hero-1200.avif")), true);
});
