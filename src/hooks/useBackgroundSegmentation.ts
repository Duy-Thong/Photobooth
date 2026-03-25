import { useEffect, useRef, useState, useCallback } from 'react'
import { ImageSegmenter, FilesetResolver, type ImageSegmenterResult } from '@mediapipe/tasks-vision'

interface UseBackgroundSegmentationReturn {
  segmentationResultRef: React.RefObject<ImageSegmenterResult | null>
  isReady: boolean
  error: string | null
  processFrame: (videoElement: HTMLVideoElement) => void
  isProcessing: boolean
}

export function useBackgroundSegmentation(): UseBackgroundSegmentationReturn {
  const segmenterRef = useRef<ImageSegmenter | null>(null)
  const segmentationResultRef = useRef<ImageSegmenterResult | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const initializeSegmenter = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
      )

      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })

      segmenterRef.current = segmenter
      setIsReady(true)
      console.log('✅ Background Segmenter initialized')
    } catch (err) {
      console.error('Background segmenter init error:', err)
      setError(err instanceof Error ? err.message : 'Failed to init segmenter')
    }
  }, [])

  const processFrame = useCallback((video: HTMLVideoElement) => {
    if (!segmenterRef.current || video.readyState < 2) return

    try {
      setIsProcessing(true)
      const startTimeMs = performance.now()
      segmenterRef.current.segmentForVideo(video, startTimeMs, (result) => {
        segmentationResultRef.current = result
        setIsProcessing(false)
      })
    } catch (err) {
      console.error('Segmentation error:', err)
      setIsProcessing(false)
    }
  }, [])

  useEffect(() => {
    initializeSegmenter()
    return () => {
      if (segmenterRef.current) {
        segmenterRef.current.close()
        segmenterRef.current = null
      }
    }
  }, [initializeSegmenter])

  return {
    segmentationResultRef,
    isReady,
    error,
    processFrame,
    isProcessing
  }
}
