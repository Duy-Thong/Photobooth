import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, updateDoc, writeBatch, doc } from 'firebase/firestore'
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Helper function to calculate layout
function getLayoutFromSlots(slots) {
  if (!slots || !Array.isArray(slots) || slots.length === 0) return 'unknown';
  const xs = slots.map(s => s.x);
  const ys = slots.map(s => s.y);
  const uniqueX = [];
  const uniqueY = [];
  const tolerance = 40;
  xs.sort((a, b) => a - b).forEach(x => {
    if (uniqueX.length === 0 || x - uniqueX[uniqueX.length - 1] > tolerance) uniqueX.push(x);
  });
  ys.sort((a, b) => a - b).forEach(y => {
    if (uniqueY.length === 0 || y - uniqueY[uniqueY.length - 1] > tolerance) uniqueY.push(y);
  });
  return `${uniqueX.length}x${uniqueY.length}`;
}

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

const adminEmail = env.ADMIN_EMAIL || env.VITE_ADMIN_EMAIL
const adminPassword = env.ADMIN_PASSWORD || '123456' // Default if not in env

if (!adminEmail) {
    console.error('❌ Missing ADMIN_EMAIL in .env')
    process.exit(1)
}

// ── Initialize ────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = initializeAuth(app, { persistence: inMemoryPersistence })

async function main() {
    console.log(`🔐  Signing in as ${adminEmail} ...`)
    try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
        console.log(' ✅ Đã đăng nhập!')
    } catch (err) {
        console.error(`\n❌ Auth failed: ${err.message}`)
        process.exit(1)
    }

    console.log('--- Đang quét Firestore frames... ---')
    const querySnapshot = await getDocs(collection(db, 'frames'))
    
    if (querySnapshot.empty) {
      console.log('Không tìm thấy khung hình nào.')
      await signOut(auth)
      return
    }

    let updatedCount = 0
    const batch = writeBatch(db)

    for (const d of querySnapshot.docs) {
      const data = d.data()
      if (!data.layout && data.slots_data) {
        const layout = getLayoutFromSlots(data.slots_data)
        console.log(`Cập nhật: ${data.name} -> ${layout}`)
        batch.update(doc(db, 'frames', d.id), { layout })
        updatedCount++
      } else if (data.layout) {
        console.log(`Đã có: ${data.name} [${data.layout}]`)
      }
    }

    if (updatedCount > 0) {
      await batch.commit()
      console.log(`\n✨ --- Đã cập nhật xong ${updatedCount} khung hình! ---`)
    } else {
      console.log('\nTất cả khung hình đã có layout.')
    }

    await signOut(auth)
    process.exit(0)
}

main().catch(err => {
    console.error('❌ Lỗi script:', err)
    process.exit(1)
})
