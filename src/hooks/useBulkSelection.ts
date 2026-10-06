import { useState, useCallback, useMemo } from 'react'

export interface BulkSelection<T = string> {
  selectedKeys: Set<T>
  selectedList: T[]
  selectedCount: number
  isSelected: (key: T) => boolean
  toggle: (key: T) => void
  select: (keys: T | T[]) => void
  deselect: (keys: T | T[]) => void
  selectAll: (keys: T[]) => void
  clear: () => void
  isAllSelected: (keys: T[]) => boolean
  setSelectedKeys: React.Dispatch<React.SetStateAction<Set<T>>>
}

/**
 * Reusable hook to manage bulk item selections (e.g. for media cards, tables).
 */
export function useBulkSelection<T = string>(initialSelected: T[] = []): BulkSelection<T> {
  const [selectedKeys, setSelectedKeys] = useState<Set<T>>(() => new Set(initialSelected))

  const isSelected = useCallback(
    (key: T) => selectedKeys.has(key),
    [selectedKeys],
  )

  const toggle = useCallback((key: T) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const select = useCallback((keys: T | T[]) => {
    const arr = Array.isArray(keys) ? keys : [keys]
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      arr.forEach((k) => next.add(k))
      return next
    })
  }, [])

  const deselect = useCallback((keys: T | T[]) => {
    const arr = Array.isArray(keys) ? keys : [keys]
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      arr.forEach((k) => next.delete(k))
      return next
    })
  }, [])

  const selectAll = useCallback((keys: T[]) => {
    setSelectedKeys(new Set(keys))
  }, [])

  const clear = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const isAllSelected = useCallback(
    (keys: T[]) => keys.length > 0 && keys.every((k) => selectedKeys.has(k)),
    [selectedKeys],
  )

  const selectedList = useMemo(() => Array.from(selectedKeys), [selectedKeys])
  const selectedCount = selectedKeys.size

  return {
    selectedKeys,
    selectedList,
    selectedCount,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    clear,
    isAllSelected,
    setSelectedKeys,
  }
}
