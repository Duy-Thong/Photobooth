/**
 * Sets CORS on the Firebase Storage bucket using the firebase-tools
 * credentials already stored on this machine (no gsutil/gcloud needed).
 */
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { join } from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Load .env ─────────────────────────────────────────────────────────────────
let envPath = path.join(ROOT, '.env.local')
if (!existsSync(envPath)) envPath = path.join(ROOT, '.env')

if (!existsSync(envPath)) {
    console.error('❌ .env or .env.local not found.')
    process.exit(1)
}

const env = Object.fromEntries(
    readFileSync(envPath, 'utf-8')
        .split('\n')
        .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
        .map(l => {
            const idx = l.indexOf('=')
            const key = l.slice(0, idx).trim()
            const val = l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
            return [key, val]
        }),
)

const BUCKET = env.VITE_FIREBASE_STORAGE_BUCKET || 'somedia-b1b9a.firebasestorage.app'

const CORS_CONFIG = [
    {
        origin: ['*'],
        method: ['GET', 'HEAD'],
        responseHeader: ['Content-Type', 'Content-Length', 'Content-Disposition'],
        maxAgeSeconds: 3600,
    },
]

// Read access token from firebase-tools credentials
const credsPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json')
if (!existsSync(credsPath)) {
    console.error(`❌ firebase-tools credentials not found at ${credsPath}. Please run 'firebase login' first.`)
    process.exit(1)
}
const creds = JSON.parse(readFileSync(credsPath, 'utf8'))
const { access_token, refresh_token, expires_at } = creds.tokens

// Refresh if expired
let token = access_token
if (Date.now() >= expires_at - 60_000) {
    console.log('Access token expired, refreshing...')
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        console.error('❌ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing in .env')
        process.exit(1)
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token,
            grant_type: 'refresh_token',
        }),
    })
    const data = await res.json()
    if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data))
    token = data.access_token
    console.log('Token refreshed.')
}

// Patch CORS on the bucket via GCS JSON API
const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}?fields=cors`
const res = await fetch(url, {
    method: 'PATCH',
    headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cors: CORS_CONFIG }),
})

if (!res.ok) {
    const err = await res.text()
    throw new Error(`GCS API error ${res.status}: ${err}`)
}

const result = await res.json()
console.log('✅ CORS set successfully!')
console.log(JSON.stringify(result, null, 2))
