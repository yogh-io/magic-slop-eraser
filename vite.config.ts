import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const ERASER_API = process.env.ERASER_API ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
    strictPort: false,
    // Proxy API routes to the bun server during dev so /docs/, /catalogue, etc.
    // hit the same origin as the SPA. Override target with ERASER_API env var
    // if running the API on a non-default port.
    proxy: {
      '/docs': { target: ERASER_API, changeOrigin: true },
      '/catalogue': { target: ERASER_API, changeOrigin: true },
      '/health': { target: ERASER_API, changeOrigin: true },
    },
  },
})
