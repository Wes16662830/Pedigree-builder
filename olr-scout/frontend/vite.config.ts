import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Do not inherit the parent repo's Tailwind PostCSS config.
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000", "/healthz": "http://localhost:8000" },
  },
});
