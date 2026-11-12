
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'


export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": process.env.FIGMA
        ? `http://localhost:${process.env.API_PORT ?? "3000"}`
        : "http://localhost:3000",
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
 
 
