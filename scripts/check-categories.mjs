
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
