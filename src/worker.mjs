// Production worker for victoriafitness.vn (Cloudflare Worker name: rough-night-ed55).
// Asset hosting stays in the ASSETS binding. This module only:
// - 301-redirects the apex host to www
// - confirms lead delivery by proxying the existing Google Apps Script webhook
// - lets static assets, including the custom 404 page, render everything else

export const CANONICAL_HOST = "www.victoriafitness.vn";
export const APEX_HOST = "victoriafitness.vn";
export const LEAD_UPSTREAM =
  "https://script.google.com/macros/s/AKfycbwoL-TDGnhNWOBGRDvj-9rJm0UabvWtd1sJVCqs48g_Vwh05w7Q9q55d6QoLP0btpV5/exec";

const MAX_LEAD_BYTES = 32_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function allowedUpstream(target) {
  let host = "";
  try {
    host = new URL(target).hostname;
  } catch {
    return false;
  }
  return host === "script.google.com" || host.endsWith(".googleusercontent.com");
}

export async function forwardLead(request, fetchImpl = fetch) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const raw = await request.text();
  if (!raw || raw.length > MAX_LEAD_BYTES) return json({ ok: false, error: "payload" }, 400);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "payload" }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ ok: false, error: "payload" }, 400);
  }

  const posted = await fetchImpl(LEAD_UPSTREAM, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  let resultResponse = posted;
  if (posted.status >= 300 && posted.status < 400) {
    const location = posted.headers.get("location");
    if (!location || !allowedUpstream(location)) return json({ ok: false, error: "upstream" }, 502);
    resultResponse = await fetchImpl(location, { method: "GET", redirect: "follow" });
  }

  const text = await resultResponse.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!resultResponse.ok || data?.ok !== true) return json({ ok: false, error: "upstream" }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/lead") return forwardLead(request);

    if (url.hostname === APEX_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
