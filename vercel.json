import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@firebase/firestore/")) return "firebase-firestore"
        }
      }
    }
  },
  plugins: [
    react(),

    ...(mode === "analyze"
      ? [
          visualizer({
            filename: "node_modules/.cache/bundle-report.html",
            template: "treemap",
            gzipSize: true,
            open: true
          })
        ]
      : [])
  ]
}))