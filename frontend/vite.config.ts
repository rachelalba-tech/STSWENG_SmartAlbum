
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'


export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      "/api": "https://stsweng-smartalbum.onrender.com/",
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    pool: "vmThreads",
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
 
 
