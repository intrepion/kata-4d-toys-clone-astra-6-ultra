import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "three-engine": ["three"],
        },
      },
    },
    // Three.js is the local, offline-capable rendering engine.
    chunkSizeWarningLimit: 600,
  },
});
