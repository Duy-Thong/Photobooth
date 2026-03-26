
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCE1ucRmA662uTDBDbgzv5K3etgvZGOyE8",
  authDomain: "somedia-b1b9a.firebaseapp.com",
  projectId: "somedia-b1b9a",
  storageBucket: "somedia-b1b9a.firebasestorage.app",
  messagingSenderId: "1041780804476",
  appId: "1:1041780804476:web:c3b501db61ffb49a02f2f9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = "duythong.ptit@gmail.com";
const ADMIN_PASSWORD = "Duythong2703@#$..";

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
