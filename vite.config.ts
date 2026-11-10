import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 4000 },
  server: { host: "0.0.0.0", port: 5180, strictPort: true },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
