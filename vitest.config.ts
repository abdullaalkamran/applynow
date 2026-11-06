import { defineConfig } from "vitest/config";

// Tests live next to what they cover: server/test for the API, src/**/*.test.ts(x) for the client.
export default defineConfig({
  test: {
    include: ["server/test/**/*.test.js", "src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
