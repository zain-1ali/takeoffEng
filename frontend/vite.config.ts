import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@takeoff/engine": fileURLToPath(
        new URL("../engine/src/index.ts", import.meta.url),
      ),
    },
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:4000",
      "/ready": "http://localhost:4000",
      "/v1": "http://localhost:4000",
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/health": "http://localhost:4000",
      "/ready": "http://localhost:4000",
      "/v1": "http://localhost:4000",
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
  },
});
