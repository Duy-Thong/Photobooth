/**
 * Sets CORS on the Firebase Storage bucket using the firebase-tools
 * credentials already stored on this machine (no gsutil/gcloud needed).
 */
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const BUCKET = 'somedia-b1b9a.firebasestorage.app'

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
const creds = JSON.parse(readFileSync(credsPath, 'utf8'))
const { access_token, refresh_token, expires_at } = creds.tokens

// Refresh if expired
let token = access_token
if (Date.now() >= expires_at - 60_000) {
    console.log('Access token expired, refreshing...')
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
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
