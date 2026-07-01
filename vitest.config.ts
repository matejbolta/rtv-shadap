import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    environmentOptions: {
      jsdom: {
        url: "https://www.rtvslo.si/"
      }
    },
    include: ["tests/**/*.test.ts"]
  }
});
