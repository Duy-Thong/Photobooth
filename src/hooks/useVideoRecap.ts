import { useRef, useCallback } from 'react'

export function useVideoRecap(
  videoRef: React.RefObject<HTMLVideoElement>,
  isMirrored: boolean,
) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number | null>(null)
  const mimeTypeRef = useRef<string>('video/webm')

  const startRecording = useCallback((fps: 24 | 30 | 60 = 30) => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    let initialised = false

    // Use requestAnimationFrame for smooth, display-sync drawing
    const draw = () => {
      if (video.videoWidth && !initialised) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        initialised = true
      }
      if (initialised) {
        ctx.save()
        if (isMirrored) {
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)

    // Give rAF a head start before starting the recorder so canvas has content
    setTimeout(() => {
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

        mimeTypeRef.current = recorder.mimeType || mimeType || 'video/webm'
        chunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start(200)
        recorderRef.current = recorder
      } catch (err) {
        console.warn('[useVideoRecap] MediaRecorder failed:', err)
      }
    }, 150)
  }, [videoRef, isMirrored])

  const stopRecording = useCallback((): Promise<string | null> => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
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
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
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
