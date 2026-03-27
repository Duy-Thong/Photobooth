export type FeedbackType = 'bug' | 'feature' | 'other'

export interface Feedback {
  id: string
  type: FeedbackType
  name: string
  message: string
  createdAt: string // ISO string
}
