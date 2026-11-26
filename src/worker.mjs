// Worker for victoriafitness.vn (production name rough-night-ed55).
// - 301 the apex host to www
// - proxy POST /api/lead to the existing Apps Script webhook
// - otherwise serve static assets, including the custom 404 page
// Redirect bugs fail open to assets. Lead errors stay on /api/lead and do not
// return the homepage.

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

export function redirectFor(request) {
  const url = new URL(request.url);
  if (url.hostname !== APEX_HOST) return null;
  url.hostname = CANONICAL_HOST;
  url.protocol = "https:";
  return url.toString();
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
  // Apps Script often saves the row, then returns HTTP 200 with an HTML body
  // the browser cannot treat as JSON. Counting that as failure makes the
  // visitor submit again and creates a duplicate lead.
  if (resultResponse.status === 200 && data == null) return json({ ok: true, confirmed: "unparsed-http-200" });
  if (resultResponse.ok && data?.ok === true) return json({ ok: true });
  return json({ ok: false, error: "upstream" }, 502);
}

export async function handle(request, env, redirectFn = redirectFor, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (url.pathname === "/api/lead") {
    try {
      return await forwardLead(request, fetchImpl);
    } catch {
      return json({ ok: false, error: "upstream" }, 502);
    }
  }
  try {
    const target = redirectFn(request);
    if (target) return Response.redirect(target, 301);
  } catch {
    // Fail open so a redirect bug cannot take the static pages offline.
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};
