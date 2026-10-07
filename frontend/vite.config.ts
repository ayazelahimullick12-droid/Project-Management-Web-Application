import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite builds and serves the prototype. `npm run dev` → http://localhost:5173
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: Number(process.env.PORT) || 5173 },
  build: { chunkSizeWarningLimit: 2000 },
})
