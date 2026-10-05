// Fairway Friends backend — Express API on port 8000 (Substrait contract:
// EXPOSE 8000, GET /health, API under /api) that also serves the built SPA
// from ./public.
//
// Boot is crash-proof by design: any startup failure falls back to a bare
// HTTP server that reports the error on /health instead of crash-looping.
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 8000;

process.on("unhandledRejection", err => console.error("UNHANDLED REJECTION (kept alive):", err?.stack || err));
process.on("uncaughtException", err => console.error("UNCAUGHT EXCEPTION (kept alive):", err?.stack || err));

// Express 4 does not await async handlers; this forwards rejections to the
// error middleware for every route registered after it.
function asyncGuard(app) {
  for (const method of ["get", "post", "put", "patch", "delete", "all", "use"]) {
    const original = app[method].bind(app);
    app[method] = (...args) => original(...args.flat().map(a => {
      if (typeof a !== "function") return a;
      if (a.length === 4) {
        return function (err, req, res, next) {
          try { return Promise.resolve(a(err, req, res, next)).catch(next); } catch (e) { return next(e); }
        };
      }
      return function (req, res, next) {
        try { return Promise.resolve(a(req, res, next)).catch(next); } catch (e) { return next(e); }
      };
    }));
  }
  return app;
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

async function main() {
  const { default: express } = await import("express");
  const { mountRounds } = await import("./rounds.js");
  const { mountCourses, seedCourses } = await import("./courses.js");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const app = asyncGuard(express());
  app.disable("x-powered-by");
  // One proxy hop (the platform ingress), so req.ip is the real client.
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    req.id = crypto.randomBytes(6).toString("hex");
    res.set("X-Request-Id", req.id);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("Strict-Transport-Security", "max-age=15552000");
    res.set("Content-Security-Policy", CSP);
    next();
  });

  app.use(express.json({ limit: "200kb" }));
  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  mountRounds(app);
  mountCourses(app);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err, req, res, _next) => {
    const status = err.status || (err.type === "entity.too.large" ? 413 : err.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) console.error("API ERROR:", req.id, req.method, req.path, err?.stack || err);
    if (res.headersSent) return res.end();
    res.status(status).json({ error: status >= 500 ? `Something went wrong on our side (ref ${req.id}).` : (err.message || "Request failed") });
  });

  const PUBLIC_DIR = path.join(__dirname, "public");
  app.use("/assets", express.static(path.join(PUBLIC_DIR, "assets"), { maxAge: "365d", immutable: true }));
  app.use(express.static(PUBLIC_DIR, { maxAge: 0, index: "index.html" }));
  app.get("/assets/*", (_req, res) => res.status(404).end());
  app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

  app.listen(PORT, () => console.log(`Fairway Friends backend listening on ${PORT}`));

  // Seed courses in the background so a slow DB can't block startup.
  seedCourses().catch(e => console.error("Course seed failed:", e?.message || e));
}

main().catch(err => {
  console.error("BOOT FAILED:", err);
  http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "boot-error", error: String(err?.stack || err) }));
  }).listen(PORT, () => console.log(`Fallback error server on ${PORT}`));
});
