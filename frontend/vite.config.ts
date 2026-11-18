
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'


export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    pool: "vmThreads",
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
 
 
