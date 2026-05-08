import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const SLOPMOP_API = process.env.SLOPMOP_API ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
    strictPort: false,
    // Proxy API routes to the bun server during dev so /docs/, /catalogue, etc.
    // hit the same origin as the SPA. Override target with SLOPMOP_API env var
    // if running the API on a non-default port.
    proxy: {
      '/docs': { target: SLOPMOP_API, changeOrigin: true },
      '/catalogue': { target: SLOPMOP_API, changeOrigin: true },
      '/health': { target: SLOPMOP_API, changeOrigin: true },
    },
  },
})
