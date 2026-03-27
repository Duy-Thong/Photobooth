
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = env.ADMIN_EMAIL || env.VITE_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

function deriveCategoryId(name) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0
    return Math.abs(h) % 90000 + 10000
}

async function main() {
  console.log('🔐 Authenticating...');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('   Authenticated successfully.');

  console.log('📡 Fetching frames from Firestore...');
  const snap = await getDocs(collection(db, 'frames'));
  const frames = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  console.log(`   Found ${frames.length} custom frames.`);

  let updated = 0;
  for (const f of frames) {
    const correctId = deriveCategoryId(f.categoryName);
    if (f.categoryId !== correctId) {
      console.log(`   🛠  Repairing "${f.name}": ${f.categoryId} -> ${correctId} (Category: ${f.categoryName})`);
      await updateDoc(doc(db, 'frames', f.firestoreId), { categoryId: correctId });
      updated++;
    }
  }

  console.log(`\n✅ Done! Repaired ${updated} frames.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
