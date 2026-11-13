import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Cross-origin isolation lets on-device speech (WebAssembly) use several threads
// (measured in docs/SPIKES.md). The static host must send the same headers (Step 30).
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // The speech runtime (about 27 MB) is cached on first use, not at install,
        // so opening the app or the sample consult never downloads it.
        globIgnores: ["**/*.wasm"],
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: "CacheFirst",
            options: { cacheName: "echo-speech-runtime" },
          },
        ],
      },
      manifest: {
        name: "Echo Care",
        short_name: "Echo Care",
        description: "Doctor visit and pharmacy counter receipt tool",
        theme_color: "#0B6B5D",
        background_color: "#F5F8F7",
      },
    }),
  ],
  server: { port: 5181, strictPort: true, headers: isolation },
  preview: { port: 5181, strictPort: true, headers: isolation },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  worker: { format: "es" },
});
