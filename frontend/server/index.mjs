/**
 * Runs the built app without Vite: `npm start` (builds first, then runs this).
 * Serves the files in dist/ and the /api routes from api.mjs. Open http://localhost:3000
 * (or the PORT you set).
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const port = Number(process.env.PORT) || 3000
const api = createApi({ dataFile: process.env.DATA_FILE ?? path.join(root, 'data', 'db.json') })

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' }

http
  .createServer(async (req, res) => {
    if (await api.handle(req, res)) return
    // Static files; any other address gets index.html (the app's own routes)
    const url = new URL(req.url ?? '/', 'http://local')
    let file = path.join(dist, decodeURIComponent(url.pathname))
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      return res.end('The app is not built yet. Run: npm run build')
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`Project Management is running at http://localhost:${port}`))
