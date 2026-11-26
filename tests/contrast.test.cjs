const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("light-surface text colors were darkened for contrast", () => {
  assert.match(html, /--gold-dark: #7c5f13;/);
  assert.match(html, /--muted: #6e6860;/);
  assert.match(html, /color: #477d50;/);
  assert.match(html, /color:#707070;/);
  assert.equal(html.includes("#7ee08f"), false);
  assert.equal(html.includes("#a67f19"), false);
  assert.match(html, /--gold: #d9b847;/);
});
