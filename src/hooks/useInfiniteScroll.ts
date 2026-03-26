import { useEffect, useRef, useState } from 'react'

/**
 * Returns a slice of `items` up to `visibleCount`, plus a `sentinelRef` to
 * attach to a sentinel element at the bottom of the list.
 * When the sentinel enters the viewport (or the given scrollable `containerRef`),
 * visibleCount is bumped by `batchSize` up to `items.length`.
 *
 * visibleCount resets to batchSize whenever `items` identity changes.
 */
export function useInfiniteScroll<T>(
  items: T[],
  batchSize = 24,
  containerRef?: React.RefObject<Element | null>,
): { visible: T[]; sentinelRef: React.RefObject<HTMLDivElement | null>; hasMore: boolean } {
  const [visibleCount, setVisibleCount] = useState(batchSize)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Reset when the list changes (filter / search / tab switch)
  useEffect(() => {
    setVisibleCount(batchSize)
  }, [items, batchSize])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    // Access .current inside useEffect — guaranteed to be populated after mount
    const root = containerRef?.current ?? null
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((v) => Math.min(v + batchSize, items.length))
        }
      },
      { root, rootMargin: '300px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  // containerRef is a stable ref object — safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, batchSize, containerRef])

  return {
    visible: items.slice(0, visibleCount),
    sentinelRef,
    hasMore: visibleCount < items.length,
  }
}
