import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Cross-origin isolation lets on-device speech (WebAssembly) use several threads
// (docs/SPIKES.md). The static host must send the same headers (Step 30).
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
        // The speech runtime (about 27 MB) is cached on first use, not at install.
        globIgnores: ["**/*.wasm"],
        runtimeCaching: [{ urlPattern: /\.wasm$/, handler: "CacheFirst", options: { cacheName: "echo-speech-runtime" } }],
      },
      manifest: {
        name: "Echo Cover",
        short_name: "Echo Cover",
        description: "Compare what hearing-aid sellers said",
        theme_color: "#1F3A6E",
        background_color: "#F3F4F8",
      },
    }),
  ],
  server: { port: 5182, strictPort: true, headers: isolation },
  preview: { port: 5182, strictPort: true, headers: isolation },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  worker: { format: "es" },
});
