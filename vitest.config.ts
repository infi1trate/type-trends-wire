import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // P2 · the whole suite runs ~220 jsdom files at once; tests that take 1.5 to 4 s alone (story days built from fixtures, the wire
    // endpoint) ran past the 5 s default under that load. 30 s still fails a test that hangs.
    testTimeout: 30_000,
    // Brand kit CSS is read as raw text (the gated /brand/files route); let vitest load it instead of stubbing it out.
    css: { include: [/brand\/.*\.css/] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
