const assert = require("node:assert/strict");
const { test } = require("node:test");

test("unparsed HTTP 200 from Apps Script counts as success and other failures do not", async () => {
  const { forwardLead, handle, LEAD_UPSTREAM } = await import("../src/worker.mjs");
  const body = JSON.stringify({ name: "TEST", phone: "0900000000", event_id: "evt-1" });
  const unparsed = await forwardLead(new Request("https://www.victoriafitness.vn/api/lead", { method: "POST", body }), async () => new Response("<html>saved</html>", { status: 200 }));
  assert.equal(unparsed.status, 200);
  assert.equal((await unparsed.json()).ok, true);

  const explicit = await forwardLead(new Request("https://www.victoriafitness.vn/api/lead", { method: "POST", body }), async () => new Response(JSON.stringify({ ok: false }), { status: 200 }));
  assert.equal(explicit.status, 502);

  const down = await forwardLead(new Request("https://www.victoriafitness.vn/api/lead", { method: "POST", body }), async () => new Response("nope", { status: 500 }));
  assert.equal(down.status, 502);

  const seen = [];
  const env = { ASSETS: { async fetch(request) { seen.push(new URL(request.url).pathname); return new Response("page", { status: 200 }); } } };
  const stillOpen = await handle(new Request("https://www.victoriafitness.vn/"), env, () => { throw new Error("redirect bug"); });
  assert.equal(await stillOpen.text(), "page");
  assert.equal(seen[0], "/");
  assert.equal(LEAD_UPSTREAM.includes("AKfycbwoL-TDGnhNWOBGRDvj-9rJm0UabvWtd1sJVCqs48g_Vwh05w7Q9q55d6QoLP0btpV5"), true);
});
