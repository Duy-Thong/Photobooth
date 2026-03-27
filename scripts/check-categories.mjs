
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function check() {
  const snap = await getDocs(collection(db, 'frames'));
  const frames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const stats = {};
  frames.forEach(f => {
    const key = f.categoryName;
    if (!stats[key]) stats[key] = [];
    stats[key].push({ id: f.categoryId, name: f.name });
  });

  console.log('--- Category Statistics ---');
  for (const [name, items] of Object.entries(stats)) {
    const ids = [...new Set(items.map(i => i.id))];
    console.log(`"${name}": IDs = [${ids.join(', ')}]`);
    if (ids.length > 1) {
      console.log(`  WARNING: Multiple IDs for same category name!`);
      items.forEach(i => console.log(`    - [${i.id}] ${i.name}`));
    }
  }
  
  process.exit(0);
}

check().catch(console.error);
