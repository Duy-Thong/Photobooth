/**
 * One-time migration: upload all static frame PNGs from public/frames/ to
 * Firebase Storage and write their metadata to Firestore `frames` collection.
 *
 * After running this, `fetchFrames()` in the app will serve frames from
 * Firebase Storage (with storageUrl) instead of /frames/ — meaning you can
 * manage ALL frames from the Admin Panel without rebuilding.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────────
 * 1. Ensure .env exists with VITE_FIREBASE_* variables.
 * 2. Have valid admin credentials (email + password from Firebase Auth).
 *
 * ── Firebase Storage rules (make sure these are in your Storage rules) ───────
 *   match /frames/{filename} {
 *     allow read: if true;
 *     allow write: if request.auth != null;
 *   }
 *
 * ── Firestore rules ───────────────────────────────────────────────────────────
 *   match /frames/{frameId} {
 *     allow read: if true;
 *     allow write: if request.auth != null;
 *   }
 *
 * ── Run ───────────────────────────────────────────────────────────────────────
 *   node scripts/upload-frames-to-firebase.mjs <admin-email> <admin-password>
 *
 * ── Options ───────────────────────────────────────────────────────────────────
 *   --dry-run   Print what would be uploaded without actually uploading.
 *   --force     Re-upload frames already present in Firestore.
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FRAMES_DIR = path.join(ROOT, 'public', 'frames')

// ── CLI flags ────────────────────────────────────────────────────────────────
const flags = process.argv.slice(2).filter(a => a.startsWith('--'))
const DRY_RUN = flags.includes('--dry-run')
const FORCE = flags.includes('--force')

// ── Load .env ─────────────────────────────────────────────────────────────────
let envPath = path.join(ROOT, '.env')
if (!existsSync(envPath)) {
    envPath = path.join(ROOT, '.env.local')
}
if (!existsSync(envPath)) {
    console.error('❌  .env or .env.local file not found. Please create one with VITE_FIREBASE_* variables.')
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
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId || !firebaseConfig.storageBucket) {
    console.error('❌  Missing Firebase config in .env (VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_STORAGE_BUCKET)')
    process.exit(1)
}

const adminEmail = env.ADMIN_EMAIL
const adminPassword = env.ADMIN_PASSWORD
if (!adminEmail || !adminPassword) {
    console.error('❌  Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env')
    process.exit(1)
}

// ── Parse STATIC_FRAMES from frames-static.ts ─────────────────────────────────
const staticFilePath = path.join(ROOT, 'src', 'lib', 'frames-static.ts')
if (!existsSync(staticFilePath)) {
    console.error('❌  src/lib/frames-static.ts not found')
    process.exit(1)
}

const staticFileContent = readFileSync(staticFilePath, 'utf-8')
// Extract the JSON array between the first '[' and the final ']'
const arrayMatch = staticFileContent.match(/STATIC_FRAMES[^=]+=\s*(\[[\s\S]*\])/)
if (!arrayMatch) {
    console.error('❌  Could not find STATIC_FRAMES array in frames-static.ts')
    process.exit(1)
}
const STATIC_FRAMES = JSON.parse(arrayMatch[1])
console.log(`📋  Found ${STATIC_FRAMES.length} static frames\n`)

if (DRY_RUN) console.log('🔍  DRY RUN — no files will be uploaded\n')

// ── Initialize Firebase ───────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const storage = getStorage(app)
// Use in-memory persistence so Firebase Auth doesn't try to use localStorage in Node.js
const auth = initializeAuth(app, { persistence: inMemoryPersistence })

// ── Sign in ───────────────────────────────────────────────────────────────────
console.log(`🔐  Signing in as ${adminEmail} ...`)
try {
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('✅  Signed in\n')
} catch (err) {
    console.error(`❌  Auth failed: ${err.message}`)
    process.exit(1)
}

// ── Upload each frame ─────────────────────────────────────────────────────────
let uploaded = 0
let skipped = 0
let failed = 0

for (const frame of STATIC_FRAMES) {
    const localPath = path.join(FRAMES_DIR, frame.filename)

    try {
        // Skip if PNG is missing locally
        if (!existsSync(localPath)) {
            console.warn(`⚠️   Missing locally: ${frame.filename} — skipping`)
            skipped++
            continue
        }

        if (DRY_RUN) {
            console.log(`🔍  Would upload: ${frame.name} (${frame.filename}, ${frame.slots} slots)`)
            uploaded++
            continue
        }

        // check if already in Firestore
        const existing = await getDocs(
            query(collection(db, 'frames'), where('filename', '==', frame.filename)),
        )

        let existingId = null
        if (!existing.empty) {
            const docSnap = existing.docs[0]
            existingId = docSnap.id
            const data = docSnap.data()

            // If not forcing, check if we need to sync slots_data or skip
            if (!FORCE) {
                if (!data.slots_data || data.slots_data.length === 0) {
                    console.log(`🆙  Syncing metadata for: ${frame.name} (${frame.filename})`)
                    await updateDoc(doc(db, 'frames', docSnap.id), {
                        slots_data: frame.slots_data,
                        slots: frame.slots,
                    })
                    uploaded++
                    continue // Continue to next frame after syncing
                }
                console.log(`⏭   Already exists: ${frame.name} (${frame.filename})`)
                skipped++
                continue // Continue to next frame if already exists and no sync needed
            }
        }

        // Upload PNG to Firebase Storage
        const fileBuffer = readFileSync(localPath)
        const storageFileRef = ref(storage, `frames/${frame.filename}`)
        await uploadBytes(storageFileRef, fileBuffer, { contentType: 'image/png' })
        const storageUrl = await getDownloadURL(storageFileRef)

        // Metadata to write
        const meta = {
            id: frame.id,
            filename: frame.filename,
            name: frame.name,
            frame: frame.frame,
            categoryId: frame.categoryId,
            categoryName: frame.categoryName,
            slots: frame.slots,
            slots_data: frame.slots_data,
            storageUrl,
        }

        if (existingId) {
            await updateDoc(doc(db, 'frames', existingId), meta)
        } else {
            await addDoc(collection(db, 'frames'), meta)
        }

        console.log(`✅  ${frame.name} (${frame.filename})`)
        uploaded++
    } catch (err) {
        console.error(`❌  ${frame.filename}: ${err.message}`)
        failed++
    }
}

await signOut(auth)

console.log(`\n✨  Done: ${uploaded} ${DRY_RUN ? 'would be uploaded' : 'uploaded'}, ${skipped} skipped, ${failed} failed`)

if (!DRY_RUN && uploaded > 0) {
    console.log('\n💡  All migrated frames now served from Firebase Storage.')
    console.log('   After migration, frames load via storageUrl and no longer depend on /public/frames/.')
}
