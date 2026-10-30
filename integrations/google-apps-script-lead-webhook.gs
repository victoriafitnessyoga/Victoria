const SHEET_NAME = "Leads";
const SPREADSHEET_ID = "18AtBtdFB34Z1uvTGLoF8-crZn93Sxlh4Z2hqfUdENt8";
const TELEGRAM_BOT_TOKEN =
  PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID =
  PropertiesService.getScriptProperties().getProperty("TELEGRAM_CHAT_ID") || "";

const HEADERS = [
  "submitted_at", "name", "phone", "interest", "goal", "branch", "consult_time", "note",
  "form_location", "page_url", "utm_source", "utm_medium", "utm_campaign", "utm_content",
  "utm_term", "fbclid", "ttclid", "gclid",
  "source_label", "traffic_type", "utm_id", "campaign_id", "campaign_name", "adset_id",
  "adset_name", "ad_id", "ad_name", "placement", "attribution_model",
  "first_source", "first_medium", "first_campaign", "first_content", "first_campaign_id",
  "first_adset_id", "first_ad_id", "first_landing_page", "first_referrer", "first_seen_at",
  "last_source", "last_medium", "last_campaign", "last_content", "last_campaign_id",
  "last_adset_id", "last_ad_id", "last_landing_page", "last_referrer", "last_seen_at",
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    lock.waitLock(30000);
    const sheet = getLeadSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map((header) => safeCell_(payload[header]));
    sheet.appendRow(row);
    lock.releaseLock();
    try { sendTelegramLead_(payload); }
    catch (error) { console.error("Telegram notification failed: " + String(error)); }
    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: String(error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function setupLeadTracking() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { getLeadSheet_(); }
  finally { lock.releaseLock(); }
}

function getLeadSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  const lastColumn = sheet.getLastColumn();
  const existing = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  const missing = HEADERS.filter((header) => existing.indexOf(header) === -1);
  // Append new fields; preserve the live sheet's extra columns, order and old leads.
  if (missing.length) {
    const needed = existing.length + missing.length;
    if (needed > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function safeCell_(value) {
  const text = String(value == null ? "" : value).slice(0, 10000);
  return /^[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
}

function sendTelegramLead_(lead) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const source = lead.source_label || [lead.utm_source, lead.utm_medium].filter(Boolean).join(" / ") || "Chưa xác định";
  const message = [
    "Lead mới từ landing page Victoria", "",
    `Tên: ${lead.name || "-"}`,
    `SĐT: ${lead.phone || "-"}`,
    `Quan tâm: ${lead.interest || "-"}`,
    `Mục tiêu: ${lead.goal || "-"}`,
    `Chi nhánh: ${lead.branch || "-"}`,
    `Khung giờ: ${lead.consult_time || "-"}`,
    `Ghi chú: ${lead.note || "-"}`,
    `Nguồn: ${source}`,
    `Chiến dịch: ${lead.campaign_name || lead.utm_campaign || "-"}`,
    `Nhóm quảng cáo: ${lead.adset_name || lead.utm_term || "-"}`,
    `Nội dung: ${lead.ad_name || lead.utm_content || "-"}`,
    `ID quảng cáo: ${lead.ad_id || "-"}`,
    `Nguồn đầu: ${lead.first_source || "-"} / ${lead.first_campaign || "-"}`,
    `Form: ${lead.form_location || "-"}`,
    `Trang: ${lead.page_url || "-"}`,
  ].join("\n").slice(0, 4000);
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method:"post", contentType:"application/json",
    payload:JSON.stringify({ chat_id:TELEGRAM_CHAT_ID, text:message, disable_web_page_preview:true }),
    muteHttpExceptions:true,
  });
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
