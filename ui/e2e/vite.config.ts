import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Serves the S16 spike page. `--host` makes it reachable from a phone on the same Wi-Fi.
export default defineConfig({
  root: fileURLToPath(new URL("./spike", import.meta.url)),
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
