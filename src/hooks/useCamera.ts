import { useEffect, useRef, useState, useCallback } from 'react'

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  isMirrored: boolean
  isReady: boolean
  error: string | null
  toggleMirror: () => void
  captureFrame: () => string | null
  switchCamera: () => void
  retryCamera: () => void
  facingMode: 'user' | 'environment'
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isMirrored, setIsMirrored] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    setIsReady(false)
    setError(null)

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    // Build constraints — facingMode is ideal (not required) so desktops don't fail
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = mediaStream
      setStream(mediaStream)

      const video = videoRef.current
      if (!video) return

      // Attach ready listener BEFORE setting srcObject to avoid missing the event
      const onReady = () => {
        setIsReady(true)
        video.removeEventListener('canplay', onReady)
        video.removeEventListener('loadedmetadata', onReady)
      }
      video.addEventListener('canplay', onReady)
      video.addEventListener('loadedmetadata', onReady)

      video.srcObject = mediaStream
      video.play().catch(() => {/* autoplay policy — fine */})
    } catch (err: unknown) {
      const e = err as DOMException
      let msg = 'Không thể truy cập camera.'
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = '🔒 Trình duyệt chưa cấp quyền camera. Nhấn vào biểu tượng khoá trên thanh địa chỉ để cho phép.'
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        msg = '📷 Không tìm thấy camera. Hãy kết nối camera và thử lại.'
      } else if (e.name === 'NotReadableError') {
        msg = '⚠️ Camera đang được dùng bởi ứng dụng khác. Hãy đóng ứng dụng đó lại.'
      }
      setError(msg)
      console.error('[useCamera]', e.name, e.message)
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMirror = useCallback(() => setIsMirrored(m => !m), [])

  const switchCamera = useCallback(() => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    startCamera(next)
  }, [facingMode, startCamera])

  const retryCamera = useCallback(() => {
    startCamera(facingMode)
  }, [facingMode, startCamera])

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || !isReady) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!

    if (isMirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [isMirrored, isReady])

  return {
    videoRef,
    stream,
    isMirrored,
    isReady,
    error,
    toggleMirror,
    captureFrame,
    switchCamera,
    retryCamera,
    facingMode,
  }
}
