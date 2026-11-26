// Apex host redirect for victoriafitness.vn.
// Static files stay on the assets binding. If redirect logic throws, the
// request still falls through to assets so the public site stays up.

export const CANONICAL_HOST = "www.victoriafitness.vn";
export const APEX_HOST = "victoriafitness.vn";

export function redirectFor(request) {
  const url = new URL(request.url);
  if (url.hostname !== APEX_HOST) return null;
  url.hostname = CANONICAL_HOST;
  url.protocol = "https:";
  return url.toString();
}

export async function handle(request, env, redirectFn = redirectFor) {
  try {
    const target = redirectFn(request);
    if (target) return Response.redirect(target, 301);
  } catch {
    // Fail open: a bug here must not replace the static site with an error page.
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};
