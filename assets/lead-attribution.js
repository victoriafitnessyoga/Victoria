(function (window, document) {
  "use strict";

  const storageKey = "victoria.lead-attribution.v1";
  const retentionMs = 30 * 24 * 60 * 60 * 1000;
  const keys = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id",
    "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
    "adgroup_id", "adgroup_name", "placement", "fbclid", "ttclid", "gclid", "gbraid", "wbraid",
  ];
  const clean = (value) => {
    const text = String(value || "").trim().slice(0, 1000);
    return /\{\{[^}]+\}\}|__[A-Z][A-Z0-9_]*__/.test(text) ? "" : text;
  };
  const hostOf = (value) => {
    try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
    catch { return ""; }
  };
  const belongsTo = (host, domain) => host === domain || host.endsWith("." + domain);
  const isInternal = (host) => host === hostOf(window.location.href) || belongsTo(host, "victoriafitness.vn");
  const normalizeSource = (source) => ({ fb:"facebook", ig:"instagram", messenger:"messenger", an:"audience_network" })[source] || source;
  const isNumericId = (value) => /^\d+$/.test(value || "");

  const readTouch = () => {
    const params = new URLSearchParams(window.location.search);
    const incoming = {};
    params.forEach((value, key) => { incoming[key.toLowerCase()] = clean(value); });
    const touch = Object.fromEntries(keys.map((key) => [key, incoming[key] || ""]));
    const explicit = keys.some((key) => Boolean(touch[key]));
    touch.utm_source = normalizeSource(touch.utm_source.toLowerCase());
    touch.utm_medium = touch.utm_medium.toLowerCase();
    touch.campaign_id = touch.campaign_id || touch.utm_id || (isNumericId(touch.utm_campaign) ? touch.utm_campaign : "");
    touch.campaign_name = touch.campaign_name || (isNumericId(touch.utm_campaign) ? "" : touch.utm_campaign);
    touch.adset_id = touch.adset_id || touch.adgroup_id || (isNumericId(touch.utm_term) ? touch.utm_term : "");
    touch.adset_name = touch.adset_name || touch.adgroup_name || (isNumericId(touch.utm_term) ? "" : touch.utm_term);
    touch.ad_name = touch.ad_name || (isNumericId(touch.utm_content) ? "" : touch.utm_content);
    touch.ad_id = touch.ad_id || (isNumericId(touch.utm_content) ? touch.utm_content : "");

    const referrerHost = hostOf(document.referrer);
    const externalReferrer = referrerHost && !isInternal(referrerHost) ? referrerHost : "";
    if (!touch.utm_source) {
      if (touch.ttclid) touch.utm_source = "tiktok";
      else if (touch.gclid || touch.gbraid || touch.wbraid) touch.utm_source = "google";
      else if (belongsTo(externalReferrer, "instagram.com")) touch.utm_source = "instagram";
      else if (belongsTo(externalReferrer, "facebook.com") || belongsTo(externalReferrer, "fb.com")) touch.utm_source = "facebook";
      else if (touch.fbclid) touch.utm_source = "meta";
      else if (belongsTo(externalReferrer, "tiktok.com")) touch.utm_source = "tiktok";
      else if (belongsTo(externalReferrer, "zalo.me") || belongsTo(externalReferrer, "zaloapp.com")) touch.utm_source = "zalo";
      else if (/^(?:[a-z0-9-]+\.)?google\.(?:com|com\.vn|co\.uk|com\.au|ca|de|fr|jp)$/.test(externalReferrer)) touch.utm_source = "google";
      else if (belongsTo(externalReferrer, "bing.com")) touch.utm_source = "bing";
      else if (externalReferrer) touch.utm_source = externalReferrer;
    }
    if (!touch.utm_medium) {
      if (touch.ttclid && touch.utm_source === "tiktok") touch.utm_medium = "paid_social";
      else if ((touch.gclid || touch.gbraid || touch.wbraid) && touch.utm_source === "google") touch.utm_medium = "cpc";
      else if (["google", "bing"].includes(touch.utm_source) && externalReferrer) touch.utm_medium = "organic_search";
      else if (externalReferrer) touch.utm_medium = "referral";
      else touch.utm_medium = "unknown";
    }
    touch.utm_source = touch.utm_source || "unknown";
    touch.utm_campaign = touch.utm_campaign || touch.campaign_name || touch.campaign_id;
    touch.utm_content = touch.utm_content || touch.ad_name || touch.ad_id;
    touch.utm_term = touch.utm_term || touch.adset_name || touch.adset_id;
    touch.traffic_type = /^(?:paid(?:[ _-].*)?|cpc|ppc|cpm|display)$/.test(touch.utm_medium) ? "paid"
      : /^(?:organic(?:[ _-].*)?|social)$/.test(touch.utm_medium) ? "organic"
      : touch.utm_medium === "referral" ? "referral" : "unknown";
    const sourceNames = { facebook:"Facebook", instagram:"Instagram", meta:"Meta", tiktok:"TikTok", google:"Google", bing:"Bing", zalo:"Zalo", messenger:"Messenger", audience_network:"Audience Network", unknown:"Chưa xác định" };
    const typeNames = { paid:"Quảng cáo", organic:"Tự nhiên (theo nhãn link)", referral:"Link giới thiệu", unknown:"Chưa rõ loại nguồn" };
    touch.source_label = touch.utm_source === "unknown" ? sourceNames.unknown : `${sourceNames[touch.utm_source] || touch.utm_source} / ${typeNames[touch.traffic_type]}`;
    touch.landing_page = window.location.origin + window.location.pathname;
    touch.referrer = externalReferrer;
    touch.seen_at = new Date().toISOString();
    touch.recognized = explicit || Boolean(externalReferrer);
    return touch;
  };

  const loadSaved = () => {
    for (const name of ["localStorage", "sessionStorage"]) {
      try {
        const saved = JSON.parse(window[name].getItem(storageKey) || "null");
        if (saved?.version === 1 && saved.expires_at > Date.now() && saved.first_touch?.seen_at && saved.last_touch?.seen_at) return saved;
      } catch { /* Storage can be unavailable in private browsers. */ }
    }
    return null;
  };
  const arrival = readTouch();
  const saved = loadSaved();
  const state = {
    version:1,
    expires_at:arrival.recognized || !saved ? Date.now() + retentionMs : saved.expires_at,
    first_touch:saved?.first_touch || arrival,
    // A visit without source information must not erase the last identifiable source.
    last_touch:arrival.recognized || !saved ? arrival : saved.last_touch,
  };
  for (const name of ["localStorage", "sessionStorage"]) {
    try { window[name].setItem(storageKey, JSON.stringify(state)); }
    catch { /* Form submission still works when storage is blocked. */ }
  }

  window.victoriaAttribution = {
    getPayload() {
      const latest = state.last_touch;
      const payload = Object.fromEntries(keys.map((key) => [key, latest[key] || ""]));
      Object.assign(payload, {
        source_label:latest.source_label,
        traffic_type:latest.traffic_type,
        attribution_model:"first_and_last_identifiable_30d",
      });
      for (const [prefix, touch] of [["first", state.first_touch], ["last", latest]]) {
        Object.assign(payload, {
          [prefix + "_source"]:touch.utm_source,
          [prefix + "_medium"]:touch.utm_medium,
          [prefix + "_campaign"]:touch.utm_campaign,
          [prefix + "_content"]:touch.utm_content,
          [prefix + "_campaign_id"]:touch.campaign_id,
          [prefix + "_adset_id"]:touch.adset_id,
          [prefix + "_ad_id"]:touch.ad_id,
          [prefix + "_landing_page"]:touch.landing_page,
          [prefix + "_referrer"]:touch.referrer,
          [prefix + "_seen_at"]:touch.seen_at,
        });
      }
      return payload;
    },
  };
})(window, document);
