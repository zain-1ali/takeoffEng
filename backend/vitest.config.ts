import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      JWT_ACCESS_SECRET: "test-access-secret-key",
      JWT_REFRESH_SECRET: "test-refresh-secret-key",
      CLIENT_URL: "http://localhost:5173",
      WEB_URL: "http://localhost:5173",
    },
  },
});
