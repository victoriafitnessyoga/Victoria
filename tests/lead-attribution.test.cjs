const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const tracker = fs.readFileSync(path.join(root, "assets/lead-attribution.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "integrations/google-apps-script-lead-webhook.gs"), "utf8");
const storageKey = "victoria.lead-attribution.v1";
const meta = "?utm_source=fb&utm_medium=paid_social&utm_campaign=Platinum&utm_content=VideoBang&utm_term=Women&campaign_id=101&adset_id=202&ad_id=303&fbclid=fb-click";
function storage() {
  const map = new Map();
  return { getItem:key => map.get(key) || null, setItem:(key, value) => map.set(key, value) };
}
function visit(query = "", options = {}) {
  const window = {
    location:new URL("https://www.victoriafitness.vn/" + query),
    localStorage:options.local || storage(), sessionStorage:options.session || storage(),
  };
  const instant = options.now || Date.now();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } }
  const context = vm.createContext({ window, document:{ referrer:options.referrer || "" }, URL, URLSearchParams, Date:Clock });
  vm.runInContext(tracker, context);
  return { window, payload:window.victoriaAttribution.getPayload() };
}

test("Meta names, IDs and click ID are sent together", () => {
  const p = visit(meta).payload;
  assert.equal(p.utm_source, "facebook");
  assert.equal(p.traffic_type, "paid");
  assert.equal(p.campaign_name, "Platinum");
  assert.equal(p.ad_name, "VideoBang");
  assert.equal(p.adset_name, "Women");
  assert.equal(p.ad_id, "303");
  assert.equal(p.first_ad_id, "303");
  assert.equal(p.last_ad_id, "303");
});
test("return without query preserves attribution and never stores customer fields", () => {
  const local = storage();
  visit(meta + "&phone=private&email=private", { local });
  const p = visit("#dang-ky", { local }).payload;
  assert.equal(p.ad_id, "303");
  assert.equal(p.fbclid, "fb-click");
  assert.equal(JSON.stringify(p).includes("private"), false);
  assert.equal(local.getItem(storageKey).includes("private"), false);
});
test("a new campaign changes last touch without mixing older Meta identifiers", () => {
  const local = storage();
  visit(meta, { local });
  const p = visit("?utm_source=tiktok&utm_medium=paid_social&utm_campaign=Ruby&utm_content=VideoNgoc&ad_id=404&ttclid=tt-click", { local }).payload;
  assert.equal(p.first_source, "facebook");
  assert.equal(p.first_ad_id, "303");
  assert.equal(p.last_source, "tiktok");
  assert.equal(p.ad_id, "404");
  assert.equal(p.fbclid, "");
  assert.equal(p.campaign_id, "");
});
test("organic links replace the latest source without importing paid IDs", () => {
  const local = storage();
  visit(meta, { local });
  const p = visit("?utm_source=ig&utm_medium=organic_social&utm_campaign=november&utm_content=link_in_bio", { local }).payload;
  assert.equal(p.utm_source, "instagram");
  assert.equal(p.traffic_type, "organic");
  assert.equal(p.first_source, "facebook");
  assert.equal(p.ad_id, "");
});
test("fbclid alone cannot prove a paid ad", () => {
  const p = visit("?fbclid=some-click").payload;
  assert.equal(p.utm_source, "meta");
  assert.equal(p.traffic_type, "unknown");
});
test("untagged Facebook referral cannot prove paid versus organic", () => {
  const p = visit("", { referrer:"https://l.facebook.com/" }).payload;
  assert.equal(p.utm_source, "facebook");
  assert.equal(p.traffic_type, "referral");
});
test("Google organic, Google ad click, TikTok ad click and unknown are separate", () => {
  assert.equal(visit("", { referrer:"https://www.google.com/search?q=vic" }).payload.traffic_type, "organic");
  assert.equal(visit("?gclid=google-click").payload.traffic_type, "paid");
  assert.equal(visit("?ttclid=tiktok-click").payload.traffic_type, "paid");
  assert.equal(visit().payload.utm_source, "unknown");
  assert.equal(visit().payload.traffic_type, "unknown");
});
test("internal navigation never overwrites the last campaign", () => {
  const local = storage();
  visit(meta, { local });
  assert.equal(visit("#contact", { local, referrer:"https://victoriafitness.vn/" }).payload.ad_id, "303");
});
test("unknown first visit is preserved when a later campaign is identified", () => {
  const local = storage();
  visit("", { local });
  const p = visit(meta, { local }).payload;
  assert.equal(p.first_source, "unknown");
  assert.equal(p.last_source, "facebook");
});
test("attribution expires after 30 days", () => {
  const local = storage();
  visit(meta, { local, now:1000000 });
  const p = visit("", { local, now:1000000 + 31 * 86400000 }).payload;
  assert.equal(p.utm_source, "unknown");
  assert.equal(p.first_ad_id, "");
});
test("blocked and malformed storage do not prevent source capture", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(visit(meta, { local:blocked, session:blocked }).payload.ad_id, "303");
  const malformed = storage();
  malformed.setItem(storageKey, "broken-json");
  assert.equal(visit(meta, { local:malformed }).payload.ad_id, "303");
});
test("session storage preserves source when persistent storage is unavailable", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const session = storage();
  visit(meta, { local:blocked, session });
  assert.equal(visit("", { local:blocked, session }).payload.ad_id, "303");
});
test("unexpanded platform macros are not recorded as real campaign data", () => {
  const p = visit("?utm_source=facebook&utm_campaign={{campaign.name}}&ad_id=__CID__").payload;
  assert.equal(p.utm_campaign, "");
  assert.equal(p.ad_id, "");
});
test("ID-only templates remain compatible", () => {
  const p = visit("?utm_source=fb&utm_medium=paid_social&utm_campaign=111&utm_term=222&utm_content=333").payload;
  assert.equal(p.campaign_id, "111");
  assert.equal(p.adset_id, "222");
  assert.equal(p.ad_id, "333");
});

function formHarness(fetch) {
  const attribution = visit(meta).window.victoriaAttribution;
  const calls = [];
  const status = { classList:{ toggle() {} }, style:{} };
  const button = { textContent:"Submit", setAttribute() {}, removeAttribute() {} };
  const form = { querySelector:() => button, reset() { calls.push(["reset"]); }, fields:{ bottomName:"TEST", bottomPhone:"0900000000", bottomNote:"Customer note" } };
  const context = vm.createContext({
    window:{ victoriaAttribution:attribution, dataLayer:[], fbq:(...args) => calls.push(["meta", ...args]), ttq:{ track:(...args) => calls.push(["tiktok", ...args]) } },
    document:{ title:"Victoria", getElementById:() => status },
    FormData:class { constructor(f) { this.fields = f.fields; } get(key) { return this.fields[key]; } },
    URLSearchParams, fetch, console:{ error() {} }, form,
  });
  context.window.location = new URL("https://www.victoriafitness.vn/");
  const start = html.indexOf("    const victoriaLeadEndpoint =");
  const end = html.indexOf('    document.getElementById("bottomForm")?.addEventListener', start);
  vm.runInContext(html.slice(start, end), context);
  return { context, calls, status };
}
test("form sends attribution and keeps exactly one Meta Lead plus SubmitForm on each platform", async () => {
  let sent;
  const h = formHarness(async (url, options) => { sent = JSON.parse(options.body); });
  await vm.runInContext('submitLead(form, "bottomFormSuccess", "footer")', h.context);
  assert.equal(sent.ad_id, "303");
  assert.equal(sent.note, "Customer note");
  assert.equal(h.calls.filter(x => x[0] === "meta" && x[1] === "track" && x[2] === "Lead").length, 1);
  assert.equal(h.calls.filter(x => x[0] === "meta" && x[2] === "SubmitForm").length, 1);
  assert.equal(h.calls.filter(x => x[0] === "tiktok" && x[1] === "SubmitForm").length, 1);
});
test("network failure does not send success events or reset the form", async () => {
  const h = formHarness(async () => { throw new Error("offline"); });
  await vm.runInContext('submitLead(form, "bottomFormSuccess", "footer")', h.context);
  assert.equal(h.calls.some(x => x.includes("Lead") || x.includes("SubmitForm") || x[0] === "reset"), false);
});

test("Apps Script appends new headers and maps existing extra/reordered columns safely", () => {
  const headers = ["submitted_at", "name", "phone", "owner", "gclid", "gclid", "note", "utm_source"];
  const rows = [];
  let columns = headers.length;
  let telegramCalls = 0;
  const sheet = {
    getLastColumn:() => headers.length, getMaxColumns:() => columns,
    insertColumnsAfter:(after, count) => { columns += count; }, setFrozenRows() {},
    getRange:(row, column, height, width) => ({
      getValues:() => [headers.slice(column - 1, column - 1 + width)],
      setValues:values => { headers.splice(column - 1, values[0].length, ...values[0]); },
    }),
    appendRow:row => rows.push(row),
  };
  let locked = false;
  const context = vm.createContext({
    PropertiesService:{ getScriptProperties:() => ({ getProperty:() => "" }) },
    SpreadsheetApp:{ openById:() => ({ getSheetByName:() => sheet }) },
    LockService:{ getScriptLock:() => ({ waitLock() { locked = true; }, releaseLock() { locked = false; }, hasLock:() => locked }) },
    ContentService:{ MimeType:{ JSON:"json" }, createTextOutput:text => ({ setMimeType:() => JSON.parse(text) }) },
    UrlFetchApp:{ fetch() { telegramCalls++; } }, console,
  });
  vm.runInContext(backend, context);
  const payload = { name:"TEST", phone:"0900000000", utm_source:"facebook", ad_id:"303", first_source:"instagram", note:"=HYPERLINK(\"bad\")" };
  const response = context.doPost({ postData:{ contents:JSON.stringify(payload) } });
  assert.equal(response.ok, true);
  assert.equal(rows[0][headers.indexOf("phone")], "0900000000");
  assert.equal(rows[0][headers.indexOf("ad_id")], "303");
  assert.equal(rows[0][headers.indexOf("first_source")], "instagram");
  assert.equal(rows[0][3], "");
  assert.equal(rows[0][headers.indexOf("note")].startsWith("'="), true);
  assert.equal(locked, false);
  assert.equal(telegramCalls, 0);
});

test("all inline scripts and backend parse", () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  new vm.Script(backend);
});
