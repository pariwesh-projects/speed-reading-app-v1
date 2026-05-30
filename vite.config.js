import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
   base: "/speed-reading-app-v1/",
  plugins: [react()],
})
