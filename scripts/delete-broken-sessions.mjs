/**
 * Bulk delete orphaned session records in Firestore.
 * 
 * Run:
 *   node scripts/delete-broken-sessions.mjs
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, deleteDoc } from 'firebase/firestore'
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'

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

const adminEmail = env.ADMIN_EMAIL
const adminPassword = env.ADMIN_PASSWORD

if (!adminEmail || !adminPassword) {
    console.error('❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env')
    process.exit(1)
}

// ── IDs identified from find-broken-sessions.mjs ────────────────────────────
const IDs_TO_DELETE = [
  "mn7oceki-6dadcz", "mn7oay5h-iotppo", "mn7o664f-1zh9z2", "mn7o65zo-hrxmpf",
  "mn7o5ilo-ksaw5a", "mn7o5ihb-3fkd1i", "mn7o5iqk-kzl4vx", "mn7o379y-e4eopy",
  "mn7o0ru4-wzhgbx", "mn7nvv8f-mswf8m", "mn7nq1ru-zb3ctb", "mn7nfzrm-km26l3",
  "mn7nfzxu-zfr31g", "mn7nfot6-hc9qrr", "mn7nfoxj-cro07v", "mn7nalys-d42shw",
  "mn7n8kih-vv4dmd", "mn7mzznj-ah3xi6", "mn7mmnsu-qorkje", "mn7mhvx7-2anm3s",
  "mn7mdnka-d0zr52", "mn7mbwm1-6fmowg", "mn7maxeb-766zpo", "mn7m7b6v-ht3od0",
  "mn7g2a60-jhefuq", "mn7g2a2r-h8isyp", "mn7fw6pj-5boh3w", "mn7fw2iz-elvsif",
  "mn7dg7e6-3xbe63", "mn7dg76b-2smsvn", "mn7dg75d-4zupz4", "mn7dg765-u8bqx9",
  "mn7deyzd-kfhm6t", "mn7a2345-w2el5i", "mn7a1xx5-722jin", "mn79lzof-zd8r87",
  "mn79i0b8-ax9xw7", "mn79hytx-4pvvko", "mn76ped5-1q4ta5", "mn76pcd5-31j413",
  "mn76pa3d-hoouzs", "mn76nwsz-m5k9ce", "mn76lzif-oieyh0"
]

// ── Initialize ────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = initializeAuth(app, { persistence: inMemoryPersistence })

async function main() {
    process.stdout.write(`🔐  Signing in as ${adminEmail} ...`)
    try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
        console.log(' ✅\n')
    } catch (err) {
        console.error(`\n❌ Auth failed: ${err.message}`)
        process.exit(1)
    }

    console.log(`🧹  Bắt đầu xóa ${IDs_TO_DELETE.length} session lỗi từ Firestore...`)
    
    let deleted = 0
    let failed = 0

    for (const id of IDs_TO_DELETE) {
        try {
            await deleteDoc(doc(db, 'sessions', id))
            deleted++
            process.stdout.write('✓') 
        } catch (err) {
            console.error(`\n❌  Lỗi khi xóa ${id}:`, err.message)
            failed++
        }
    }

    await signOut(auth)

    console.log(`\n\n✨  Hoàn tất!`)
    console.log(`-----------------------------------`)
    console.log(`Tổng số cần xóa: ${IDs_TO_DELETE.length}`)
    console.log(`Thành công: ${deleted}`)
    console.log(`Thất bại: ${failed}`)
    console.log(`-----------------------------------`)
    console.log(`Database của bạn hiện đã sạch bóng record rác.`)
}

main().catch(err => {
    console.error('❌ Lỗi script:', err)
})
