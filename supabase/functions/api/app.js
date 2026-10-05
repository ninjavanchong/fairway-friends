// Request router for the `api` Edge Function. Web-standard Request -> Response, so it runs
// in Deno (Supabase) and in Node (scripts/dev-server.mjs). Routes are registered by rounds.js and
// courses.js with an express-like surface (app.get/post/..., req.params/query/body, res.status().json()).
import { mountRounds } from "./rounds.js";
import { mountCourses } from "./courses.js";

const routes = [];
const compile = path => {
  const keys = [];
  const re = new RegExp("^" + path.replace(/:[A-Za-z]+/g, m => { keys.push(m.slice(1)); return "([^/]+)"; }) + "/?$");
  return { re, keys };
};
const app = {};
for (const m of ["get", "post", "put", "patch", "delete"]) {
  app[m] = (path, handler) => routes.push({ method: m.toUpperCase(), ...compile(path), handler });
}
mountRounds(app);
mountCourses(app);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-player-name, authorization, apikey",
  "Access-Control-Max-Age": "86400",
};
const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function handle(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  // Supabase passes /api/...; local dev mounts /functions/v1/api/... Both reduce to the same path.
  let path = url.pathname.replace(/^(?:\/functions\/v1)?\/api/, "") || "/";
  if (path === "/health") return json(200, { status: "ok" });
  path = "/api" + path;

  for (const r of routes) {
    if (r.method !== request.method) continue;
    const m = r.re.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    let body = {};
    if (request.method !== "GET" && request.method !== "DELETE") {
      const text = await request.text();
      if (text) {
        try { body = JSON.parse(text); } catch { return json(400, { error: "Bad request body" }); }
      }
    }
    let status = 200, payload = null;
    const res = {
      status(s) { status = s; return res; },
      json(d) { payload = d; return res; },
    };
    const req = {
      params, body,
      query: Object.fromEntries(url.searchParams),
      ip: (request.headers.get("x-forwarded-for") || "x").split(",")[0].trim(),
      get: name => request.headers.get(name),
    };
    try {
      await r.handler(req, res);
      return json(status, payload ?? {});
    } catch (err) {
      const st = err.status || 500;
      if (st >= 500) console.error("API ERROR:", request.method, path, err?.stack || err);
      return json(st, { error: st >= 500 ? "Something went wrong on our side. Please try again." : (err.message || "Request failed") });
    }
  }
  return json(404, { error: "Not found" });
}
