import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the Vite dev server proxies backend routes to the tutorial
// server, so the browser talks to one origin. In production the server
// serves the built web/dist itself. The server's port is configurable (see
// scripts/lib.sh's CORDIS_TUTORIAL_SERVER_PORT) so a --port override on the
// vite CLI and the proxy target agree - a script that only changed one of
// the two would connect to nothing.
const serverPort = process.env.CORDIS_TUTORIAL_SERVER_PORT || "8788";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: `http://localhost:${serverPort}`, changeOrigin: true },
      "/ws": { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
