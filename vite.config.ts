import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PWA manual: public/sw.js + public/manifest.webmanifest (workaround Vite 8).
// El service worker se registra manualmente en src/main.tsx.
export default defineConfig({
  plugins: [react()],
})
