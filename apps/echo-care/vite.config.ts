import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Echo Care",
        short_name: "Echo Care",
        description: "Doctor visit and pharmacy counter receipt tool",
        theme_color: "#ffffff",
      },
    }),
  ],
});
