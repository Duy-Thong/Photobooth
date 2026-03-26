/**
 * Find orphaned session records in Firestore (where the Storage file is missing).
 * 
 * Run:
 *   node scripts/find-broken-sessions.mjs
 * 
 * This script will list all session IDs that point to non-existent images.
 * It does NOT delete anything. It only lists them for your manual review.
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore'
import { getStorage, ref, getMetadata } from 'firebase/storage'

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

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
}

// ── Initialize ────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const storage = getStorage(app)

const getPathFromUrl = (url) => {
  if (!url) return null
  try {
    if (url.includes('/o/')) {
      const parts = url.split('/o/')[1].split('?')[0]
      return decodeURIComponent(parts)
    }
    return null
  } catch { return null }
}

async function main() {
    process.stdout.write('🔍  Đang quét database sessions...')
    
    const snap = await getDocs(query(collection(db, 'sessions'), orderBy('createdAt', 'desc')))
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    
    console.log(`\n📋  Tìm thấy tổng cộng ${sessions.length} sessions. Bắt đầu kiểm tra file...`)
    
    const brokenIds = []
    let checked = 0

    for (const s of sessions) {
        checked++
        const path = getPathFromUrl(s.imageUrl) || `sessions/${s.id}/strip.jpg`
        
        try {
            await getMetadata(ref(storage, path))
            // File exists
        } catch (err) {
            // Storage not found
            if (err.code === 'storage/object-not-found' || err.status === 404) {
                brokenIds.push(s.id)
                process.stdout.write('X') // Mark broken
            } else {
                process.stdout.write('?') // Unknown error
            }
            continue
        }
        process.stdout.write('.') // Mark ok
        
        if (checked % 50 === 0) console.log(` (${checked}/${sessions.length})`)
    }

    console.log('\n\n✅  Hoàn tất kiểm tra.')
    console.log(`-----------------------------------`)
    console.log(`Tổng số session: ${sessions.length}`)
    console.log(`Số session lỗi (mất file): ${brokenIds.length}`)
    console.log(`-----------------------------------`)
    
    if (brokenIds.length > 0) {
        console.log('Danh sách Session ID bị lỗi:')
        console.log(JSON.stringify(brokenIds, null, 2))
        console.log('\nBạn có thể copy danh sách này để xử lý.')
    } else {
        console.log('Không tìm thấy session nào bị mất file! Database của bạn rất sạch.')
    }
}

main().catch(err => {
    console.error('❌ Lỗi script:', err)
})
