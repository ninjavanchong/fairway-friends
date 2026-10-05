import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev is same-origin like production: relative /api paths are
    // forwarded to the backend on :8000.
    proxy: { "/api": "http://localhost:8000" },
  },
});
