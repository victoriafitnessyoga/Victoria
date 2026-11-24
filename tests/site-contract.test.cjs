const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("homepage keeps production pixels, prices, and the confirmed lead route", () => {
  assert.match(html, /<title>Phòng gym &amp; yoga Bình Thạnh, Quận 1 \| Victoria Fitness<\/title>/);
  assert.match(html, /<h1 id="hero-title">[\s\S]*Phòng gym &amp; yoga[\s\S]*Bình Thạnh &amp; Quận 1/);
  assert.match(html, /Tập luyện bền vững bắt đầu từ một lựa chọn đúng/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.victoriafitness\.vn\/"/);
  assert.match(html, /property="og:image" content="https:\/\/www\.victoriafitness\.vn\/assets\/victoria-boxing-kettlebell-hero\.jpg"/);
  assert.equal((html.match(/1445114913415739/g) || []).length >= 2, true);
  assert.match(html, /DB0G8JJC77U5SC4FO7I0/);
  assert.match(html, /fbq\.disablePushState = true/);
  assert.match(html, /historyObserver:\s*false/);
  assert.match(html, /9\.420\.000đ/);
  assert.match(html, /28\.600\.000đ/);
  assert.equal(html.includes("7.700.000"), false);
  assert.equal(html.includes("22.000.000"), false);
  assert.equal(html.includes("fonts.googleapis.com"), false);
  assert.equal(html.includes("mode:\"no-cors\""), false);
  assert.match(html, /victoriaLeadEndpoint = "\/api\/lead"/);
  assert.match(html, /href="\/chinh-sach-bao-mat"/);
  assert.match(html, /<picture><source type="image\/avif"/);
  assert.match(html, /type="application\/ld\+json"/);
  assert.match(html, /"@type": \[\s*"HealthClub",\s*"ExerciseGym"/);
  assert.match(html, /"@type": "FAQPage"/);
  assert.equal((html.match(/"@type": "Question"/g) || []).length, 7);
  assert.match(html, /eventID:eventId/);
  assert.match(html, /event_id:eventId/);
  assert.match(html, /fbq\("track", "Contact"/);
  assert.match(html, /hotline_click/);
  assert.match(html, /data-track-messenger/);
  assert.match(html, /scrollIntoView/);
});

test("TikTok pixel is loaded once without the history observer", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  const script = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(match => match[1].includes("ttq.load"));
  const inserted = [];
  const first = { parentNode:{ insertBefore:node => inserted.push(node) } };
  const document = { createElement:() => ({}), getElementsByTagName:() => [first] };
  const context = vm.createContext({ document, window:{} });
  context.window = context;
  vm.runInContext(script[1], context);
  assert.equal(context.ttq._o.DB0G8JJC77U5SC4FO7I0.historyObserver, false);
});

test("worker redirects only the apex host and confirms the Apps Script result", async () => {
  const { default: worker, LEAD_UPSTREAM, forwardLead } = await import("../src/worker.mjs");
  const assets = [];
  const env = { ASSETS:{ async fetch(request) { assets.push(request.url); return new Response("asset", { status:200 }); } } };
  const apex = await worker.fetch(new Request("http://victoriafitness.vn/bang-gia?utm_source=fb#dang-ky"), env);
  assert.equal(apex.status, 301);
  assert.equal(apex.headers.get("location"), "https://www.victoriafitness.vn/bang-gia?utm_source=fb#dang-ky");
  const www = await worker.fetch(new Request("https://www.victoriafitness.vn/"), env);
  assert.equal(www.status, 200);
  assert.equal(assets.length, 1);
  const preview = await worker.fetch(new Request("https://rough-night-ed55.example.workers.dev/"), env);
  assert.equal(preview.status, 200);

  const calls = [];
  const body = JSON.stringify({ name:"TEST", phone:"0900000000", event_id:"evt-1" });
  const response = await forwardLead(new Request("https://www.victoriafitness.vn/api/lead", { method:"POST", body }), async (url, options) => {
    calls.push({ url, options });
    if (url === LEAD_UPSTREAM) return new Response(null, { status:302, headers:{ location:"https://script.googleusercontent.com/result" } });
    return new Response(JSON.stringify({ ok:true }), { status:200 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok:true });
  assert.equal(calls[0].url, LEAD_UPSTREAM);
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[1].url, "https://script.googleusercontent.com/result");

  const denied = await forwardLead(new Request("https://www.victoriafitness.vn/api/lead", { method:"POST", body }), async () => {
    return new Response(null, { status:302, headers:{ location:"https://evil.example/steal" } });
  });
  assert.equal(denied.status, 502);
});

test("public files publish the sitemap, robots line, privacy page, and 404", () => {
  const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  const privacy = fs.readFileSync(path.join(root, "public/chinh-sach-bao-mat.html"), "utf8");
  const missing = fs.readFileSync(path.join(root, "public/404.html"), "utf8");
  assert.match(robots, /content signals/);
  assert.match(robots, /Sitemap: https:\/\/www\.victoriafitness\.vn\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/www\.victoriafitness\.vn\/</);
  assert.match(sitemap, /https:\/\/www\.victoriafitness\.vn\/chinh-sach-bao-mat/);
  assert.match(privacy, /Bản nháp/);
  assert.match(privacy, /Nghị định 13\/2023/);
  assert.match(privacy, /rel="canonical" href="https:\/\/www\.victoriafitness\.vn\/chinh-sach-bao-mat"/);
  assert.match(missing, /Về trang chủ/);
  assert.equal(fs.existsSync(path.join(root, "public/favicon.ico")), true);
  const config = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  assert.match(config, /"name": "rough-night-ed55"/);
  assert.match(config, /"not_found_handling": "404-page"/);
  assert.match(config, /"run_worker_first": true/);
});
