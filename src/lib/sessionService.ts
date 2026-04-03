import { collection, doc, setDoc, getDoc, serverTimestamp, updateDoc, query, orderBy, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'

export interface SessionData {
  id: string
  imageUrl: string        // Firebase Storage URL for strip image (with QR)
  videoUrl: string | null // Firebase Storage URL for strip video
  createdAt: string       // ISO string
  printedAt?: string | null // ISO string, null if not printed
  studioId?: string       // UID of the studio that captured this session
}

const SESSIONS_COLLECTION = 'sessions'

/** Create a new session document in Firestore. */
export async function createSession(data: Omit<SessionData, 'createdAt'>): Promise<void> {
  await setDoc(doc(collection(db, SESSIONS_COLLECTION), data.id), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

/** Fetch a session by ID. Returns null if not found. */
export async function fetchSession(id: string): Promise<SessionData | null> {
  const snap = await getDoc(doc(db, SESSIONS_COLLECTION, id))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    id: snap.id,
    imageUrl: d.imageUrl,
    videoUrl: d.videoUrl ?? null,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  }
}

/** Generate a short unique session ID. */
export function generateSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Fetch all sessions from Firestore, ordered by createdAt descending.
 *  Pass studioId to filter by studio (for studio accounts).
 */
export async function fetchSessions(studioId?: string): Promise<SessionData[]> {
  const base = collection(db, SESSIONS_COLLECTION)
  const q = studioId
    ? query(base, where('studioId', '==', studioId), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(doc => {
    const d = doc.data()
    return {
      id: doc.id,
      imageUrl: d.imageUrl,
      videoUrl: d.videoUrl ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      printedAt: d.printedAt?.toDate?.()?.toISOString() ?? null,
      studioId: d.studioId ?? undefined,
    }
  })
}

/** Mark a session as printed. */
export async function markSessionPrinted(id: string): Promise<void> {
  await updateDoc(doc(db, SESSIONS_COLLECTION, id), {
    printedAt: serverTimestamp(),
  })
}

/** Delete a session document from Firestore. */
export async function deleteSession(id: string): Promise<void> {
  await deleteDoc(doc(db, SESSIONS_COLLECTION, id))
}

/** Listen to real-time session updates from Firestore.
 *  Pass studioId to filter by studio (for studio accounts).
 *  Pass onError to handle query errors (e.g. missing composite index).
 */
export function listenToSessions(
  callback: (sessions: SessionData[]) => void,
  studioId?: string,
  onError?: (err: Error) => void,
): () => void {
  const base = collection(db, SESSIONS_COLLECTION)
  const q = studioId
    ? query(base, where('studioId', '==', studioId), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'))

  return onSnapshot(q, (snap: any) => {
    const sessions = snap.docs.map((doc: any) => {
      const d = doc.data()
      return {
        id: doc.id,
        imageUrl: d.imageUrl,
        videoUrl: d.videoUrl ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        printedAt: d.printedAt?.toDate?.()?.toISOString() ?? null,
        studioId: d.studioId ?? undefined,
      }
    })
    callback(sessions)
  }, (err) => {
    console.error('[Sessions] onSnapshot error:', err)
    if (onError) onError(err)
    else callback([]) // fallback: resolve spinner with empty list
  })
}
