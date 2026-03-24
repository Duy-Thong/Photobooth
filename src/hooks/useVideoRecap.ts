import { useRef, useCallback } from 'react'

/**
 * Records the camera feed at a given FPS using an off-screen canvas
 * (so mirror + filter CSS are by-passed — we manually apply mirror in canvas).
 * Returns a blob URL for the recorded video when stopRecording() resolves.
 * Prefers MP4/H.264 (iOS/Safari) then falls back to WebM.
 */
export function useVideoRecap(
  videoRef: React.RefObject<HTMLVideoElement>,
  isMirrored: boolean,
) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef = useRef<string>('video/webm')

  const startRecording = useCallback((fps: 12 | 24 = 12) => {
    const video = videoRef.current
    if (!video) return

    // Off-screen canvas — size deferred until first draw (video may not have dimensions yet)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    let initialised = false

    intervalRef.current = setInterval(() => {
      if (!video.videoWidth) return

      // Set canvas size once on first valid frame
      if (!initialised) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        initialised = true
      }

      ctx.save()
      if (isMirrored) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.restore()
    }, Math.round(1000 / fps))

    // Give the interval a head start before starting the recorder so canvas has content
    setTimeout(() => {
      // Prefer MP4/H.264 (plays on iOS, Android, desktop). Fall back to WebM.
      const mimeType =
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
          ? 'video/mp4;codecs=avc1'
          : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : ''

      try {
        const mediaStream = canvas.captureStream(fps)
        const recorder = mimeType
          ? new MediaRecorder(mediaStream, { mimeType })
          : new MediaRecorder(mediaStream)

        // recorder.mimeType is the canonical value after construction
        mimeTypeRef.current = recorder.mimeType || mimeType || 'video/webm'

        chunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start(200) // chunk every 200 ms
        recorderRef.current = recorder
      } catch (err) {
        console.warn('[useVideoRecap] MediaRecorder failed:', err)
      }
    }, 150)
  }, [videoRef, isMirrored])

  const stopRecording = useCallback((): Promise<string | null> => {
    // Stop the draw loop
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
        recorderRef.current = null
        chunksRef.current = []
        resolve(blob.size > 0 ? URL.createObjectURL(blob) : null)
      }
      recorder.stop()
    })
  }, [])

  const cancelRecording = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.ondataavailable = null
      recorderRef.current.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const getVideoMimeType = useCallback(() => mimeTypeRef.current, [])

  return { startRecording, stopRecording, cancelRecording, getVideoMimeType }
}
