const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const root = path.join(__dirname, "..");
test("draft privacy page is linked and leaves legal placeholders", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const page = fs.readFileSync(path.join(root, "public/chinh-sach-bao-mat.html"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  assert.match(html, /href="\/chinh-sach-bao-mat"/);
  assert.match(page, /Bản nháp — chờ rà soát pháp lý/);
  assert.match(page, /Tên pháp nhân: \[CẦN BỔ SUNG\]/);
  assert.match(page, /Mã số thuế: \[CẦN BỔ SUNG\]/);
  assert.match(page, /Email liên hệ về dữ liệu cá nhân: \[CẦN BỔ SUNG\]/);
  assert.match(page, /Thời gian lưu dữ liệu form: \[CẦN BỔ SUNG\]/);
  assert.match(sitemap, /chinh-sach-bao-mat/);
  assert.equal(html.includes("/api/lead"), false);
});
