import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgr()],
  server: {
    proxy: {
      '/api/vic': {
        target: 'https://emergency.vic.gov.au',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vic/, ''),
        secure: true,
        headers: {
          'Accept': 'application/json'
        }
      },
      '/api/weather': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, ''),
        secure: true,
        headers: {
          'Accept': 'application/json'
        }
      }
    }
  }
})