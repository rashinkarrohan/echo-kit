import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Echo Cover",
        short_name: "Echo Cover",
        description: "Hearing-aid purchase quote comparison tool",
        theme_color: "#ffffff",
      },
    }),
  ],
});
