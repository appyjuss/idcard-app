import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // This section sets up the proxy for API calls
  server: {
    proxy: {
      // Any request starting with '/api' will be forwarded
      '/api': {
        target: 'http://localhost:3001', // Your backend's address
        changeOrigin: true, // This header is often required
        // Optional: You could rewrite the path if needed, but we don't need to
        // rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})