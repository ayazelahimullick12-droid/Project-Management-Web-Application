/**
 * The small server behind the app (plain Node.js, no extra packages).
 *
 * 1. Keeps ALL app data in one JSON file (data/db.json by default). The browser loads it at start,
 *    sends back the whole data after every change, and hears about changes made in other tabs.
 *    Every save carries the version it was based on; if another tab saved first, the save is
 *    refused (409) and the browser re-applies its change on top of the newer data.
 * 2. Passes AI requests to LM Studio (its OpenAI-compatible server, normally http://localhost:1234).
 *
 * Used in two places:
 * - `npm run dev`: inside Vite (see vite.config.ts), so one command runs everything.
 * - `npm start`:   by server/index.mjs, which also serves the built app.
 *
 * Settings (environment variables, all optional):
 *   DATA_FILE      where the data is kept           (default: data/db.json next to package.json)
 *   LMSTUDIO_URL   where LM Studio's server listens (default: http://localhost:1234)
 *   AI_TIMEOUT_MS  how long to wait for one AI answer (default: 180000 = 3 minutes)
 */
import fs from 'node:fs'
import path from 'node:path'

export function createApi(options = {}) {
  const dataFile = path.resolve(options.dataFile ?? process.env.DATA_FILE ?? 'data/db.json')
  const lmStudio = (options.lmStudioUrl ?? process.env.LMSTUDIO_URL ?? 'http://localhost:1234').replace(/\/$/, '')
  const aiTimeout = Number(process.env.AI_TIMEOUT_MS) || 180_000

  // ─── The data file ────────────────────────────────────────────────────
  let version = 0
  let state = null
  if (fs.existsSync(dataFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
      version = saved.version ?? 0
      state = saved.state ?? null
    } catch (err) {
      // Keep the broken file for inspection and start fresh.
      fs.renameSync(dataFile, `${dataFile}.broken-${Date.now()}`)
      console.warn(`[data] ${dataFile} could not be read (${err.message}). Starting with empty data.`)
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true })
    const tmp = `${dataFile}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ version, savedAt: new Date().toISOString(), state }))
    fs.renameSync(tmp, dataFile) // replace in one step, so a crash never leaves half a file
  }

  // Browser tabs listening for changes (Server-Sent Events)
  const listeners = new Set()
  function broadcast() {
    for (const res of listeners) res.write(`event: version\ndata: ${version}\n\n`)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  /** Sends a JSON answer. Returns true: the request was handled. */
  function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
    return true
  }

  async function readBody(req) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const text = Buffer.concat(chunks).toString('utf8')
    return text ? JSON.parse(text) : {}
  }

  /** Forwards a request to LM Studio and returns its answer (or a clear error). */
  async function toLmStudio(res, route, body, method = 'POST') {
    try {
      const r = await fetch(`${lmStudio}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(aiTimeout),
      })
      const text = await r.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        json = { error: { message: text.slice(0, 300) } }
      }
      if (!r.ok || json.error) return send(res, 502, { error: json.error?.message ?? json.error ?? `LM Studio answered with status ${r.status}.` })
      return send(res, 200, json)
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError'
      return send(res, 502, {
        error: timedOut
          ? `LM Studio did not answer within ${Math.round(aiTimeout / 1000)} seconds.`
          : `LM Studio is not reachable at ${lmStudio}. Start LM Studio, load the model and start its server (Developer tab).`,
      })
    }
  }

  // ─── Routes ───────────────────────────────────────────────────────────
  /** Handles /api/... requests. Returns false for anything else. */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://local')
    if (!url.pathname.startsWith('/api/')) return false
    try {
      // The whole data, with its version
      if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, { version, state })

      // Save the whole data (refused when another tab saved first)
      if (url.pathname === '/api/state' && req.method === 'PUT') {
        const body = await readBody(req)
        if (body.baseVersion !== version) return send(res, 409, { version, state })
        state = body.state
        version += 1
        save()
        broadcast()
        return send(res, 200, { version })
      }

      // Change notifications for open tabs
      if (url.pathname === '/api/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
        res.write(`event: version\ndata: ${version}\n\n`)
        listeners.add(res)
        const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
        req.on('close', () => {
          clearInterval(ping)
          listeners.delete(res)
        })
        return true
      }

      // AI: chat completions, embeddings, and which models LM Studio has
      if (url.pathname === '/api/ai/chat' && req.method === 'POST') return toLmStudio(res, '/v1/chat/completions', await readBody(req))
      if (url.pathname === '/api/ai/embed' && req.method === 'POST') return toLmStudio(res, '/v1/embeddings', await readBody(req))
      if (url.pathname === '/api/ai/status' && req.method === 'GET') {
        try {
          const r = await fetch(`${lmStudio}/v1/models`, { signal: AbortSignal.timeout(5000) })
          const json = await r.json()
          return send(res, 200, { ok: true, url: lmStudio, models: (json.data ?? []).map((m) => m.id) })
        } catch {
          return send(res, 200, { ok: false, url: lmStudio, models: [], error: `LM Studio is not reachable at ${lmStudio}.` })
        }
      }

      return send(res, 404, { error: 'Unknown address.' })
    } catch (err) {
      console.error('[api]', err)
      return send(res, 500, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  console.log(`[data] ${dataFile} (version ${version}) · [ai] LM Studio at ${lmStudio}`)
  return { handle }
}
