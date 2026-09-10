import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Puerto fijo para que siempre entres por la misma URL: http://localhost:3500
    port: 3500,
    strictPort: true,
  },
})
