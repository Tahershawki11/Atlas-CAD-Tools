import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: process.env.ATLAS_TEST_URL || "http://localhost:5180",
    viewport: { width: 1440, height: 1024 },
    headless: true,
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "docs/browser-results.json" }]],
});
