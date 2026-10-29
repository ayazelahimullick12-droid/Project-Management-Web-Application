import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-expect-error plain JavaScript module (server/api.mjs)
import { createApi } from './server/api.mjs'

/** Runs the small server (data file + LM Studio) inside Vite, so `npm run dev` starts everything. */
function apiServer(): Plugin {
  return {
    name: 'project-management-api',
    configureServer(server) {
      const api = createApi()
      server.middlewares.use((req, res, next) => {
        api.handle(req, res).then((handled: boolean) => {
          if (!handled) next()
        })
      })
    },
  }
}

// `npm run dev` → http://localhost:5173 · `npm start` → builds, then http://localhost:3000
export default defineConfig({
  plugins: [react(), tailwindcss(), apiServer()],
  server: { port: Number(process.env.PORT) || 5173 },
  build: { chunkSizeWarningLimit: 2000 },
})
