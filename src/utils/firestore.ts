/**
 * Safely convert any Firestore timestamp, Date, ISO string, or number to an ISO 8601 string.
 */
export function toIsoDate(value: any, fallback = new Date().toISOString()): string {
  if (!value) return fallback
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? fallback : d.toISOString()
  }
  return fallback
}

/**
 * Generate a unique session or document identifier.
 */
export function generateShortId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
