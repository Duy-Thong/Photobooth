import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { db } from './firebase'
import type { Feedback } from '@/types/feedback'

const FEEDBACK_COLLECTION = 'feedback'

export async function submitFeedback(feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, FEEDBACK_COLLECTION), {
    ...feedback,
    createdAt: new Date().toISOString(),
  })
}

export async function fetchFeedbacks(): Promise<Feedback[]> {
  const snap = await getDocs(query(collection(db, FEEDBACK_COLLECTION), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({
    ...(d.data() as Omit<Feedback, 'id'>),
    id: d.id,
  }))
}

export async function deleteFeedback(id: string): Promise<void> {
  await deleteDoc(doc(db, FEEDBACK_COLLECTION, id))
}
