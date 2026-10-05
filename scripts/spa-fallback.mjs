// GitHub Pages has no server-side routing: serve the app for unknown paths (like /j/ABC123) via 404.html.
import fs from "node:fs";
fs.copyFileSync("dist/index.html", "dist/404.html");
console.log("dist/404.html written (SPA fallback)");
