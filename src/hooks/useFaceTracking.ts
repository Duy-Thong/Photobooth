import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'

interface UseFaceTrackingReturn {
  faceData: FaceLandmarkerResult | null
  isReady: boolean
  error: string | null
  startDetection: (videoElement: HTMLVideoElement) => void
  stopDetection: () => void
}

export function useFaceTracking(): UseFaceTrackingReturn {
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  
  const [faceData, setFaceData] = useState<FaceLandmarkerResult | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializeLandmarker = useCallback(async () => {
    try {
      setError(null)

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      )

      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1, // Only track 1 face for now
      })

      landmarkerRef.current = landmarker
      setIsReady(true)
      console.log('✅ MediaPipe FaceLandmarker initialized successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize face landmarker'
      console.error('Face landmarker initialization error:', err)
      setError(message)
    }
  }, [])

  const detectFrame = useCallback(async () => {
    if (!landmarkerRef.current || !videoRef.current) return

    try {
      const landmarker = landmarkerRef.current
      const video = videoRef.current

      if (video.readyState >= 2 && video.currentTime > 0) {
        // Detect faces in the video
        const startTimeMs = Math.round(performance.now())
        // MediaPipe requires a monotonically increasing timestamp
        const result = landmarker.detectForVideo(video, startTimeMs)
        
        if (result && result.faceLandmarks.length > 0) {
          setFaceData(result)
        } else {
          setFaceData(null)
        }
      }

      // Continue detection for next frame
      animationFrameRef.current = requestAnimationFrame(detectFrame)
    } catch (err) {
      console.error('Face detection frame error:', err)
      // Continue despite errors
      animationFrameRef.current = requestAnimationFrame(detectFrame)
    }
  }, [])

  const startDetection = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video

      if (!isReady) {
        console.warn('Face landmarker not ready yet')
        return
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      detectFrame()
    },
    [isReady, detectFrame],
  )

  const stopDetection = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    videoRef.current = null
    setFaceData(null)
  }, [])

  // Initialize landmarker on mount
  useEffect(() => {
    initializeLandmarker()

    return () => {
      stopDetection()
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
      }
    }
  }, [initializeLandmarker, stopDetection])

  return {
    faceData,
    isReady,
    error,
    startDetection,
    stopDetection,
  }
}
