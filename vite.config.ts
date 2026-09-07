import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: { overlay: false },
    watch: { usePolling: true, interval: 100 },
    optimizeDeps: { include: ["react", "react-dom"] },
  },
  build: { target: "es2020", outDir: "dist", sourcemap: false },
});
