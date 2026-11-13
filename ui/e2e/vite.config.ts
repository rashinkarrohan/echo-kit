import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Serves the e2e pages: /spike/ (S16 speech latency) and /gallery/ (S18 components).
// `--host` makes them reachable from a phone on the same Wi-Fi.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("./fixtures", import.meta.url)),
  server: {
    port: 5180,
    strictPort: true,
    // Cross-origin isolation lets WebAssembly use several threads. ISOLATED=0 turns it off
    // to measure the single-thread case.
    headers:
      process.env["ISOLATED"] === "0"
        ? {}
        : {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
          },
  },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  worker: { format: "es" },
});
