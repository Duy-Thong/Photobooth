import { useEffect, useRef, useState, useCallback } from 'react'

const shutterAudio = new Audio('/sound/shutter.mp3')
let _soundEnabled = true

function playShutterSound() {
  if (!_soundEnabled) return
  shutterAudio.currentTime = 0
  shutterAudio.play().catch(() => { /* autoplay policy */ })
}

export interface CameraDevice {
  deviceId: string
  label: string
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  isMirrored: boolean
  isReady: boolean
  error: string | null
  devices: CameraDevice[]
  activeDeviceId: string | null
  soundEnabled: boolean
  toggleMirror: () => void
  toggleSound: () => void
  captureFrame: (filterCss?: string) => string | null
  selectDevice: (deviceId: string) => void
  retryCamera: () => void
}

// Helper to detect rear/back camera from label
function isRearCameraDevice(label?: string): boolean {
  if (!label) return false
  const l = label.toLowerCase()
  return (
    l.includes('back') ||
    l.includes('rear') ||
    l.includes('sau') ||
    l.includes('environment') ||
    l.includes('kép') ||
    l.includes('rộng') ||
    l.includes('wide') ||
    l.includes('0,5') ||
    l.includes('0.5')
  )
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isMirrored, setIsMirrored] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)

  const startCamera = useCallback(async (deviceId?: string) => {
    setIsReady(false)
    setError(null)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 768

    const videoConstraint: MediaTrackConstraints = deviceId
      ? {
          deviceId: { exact: deviceId },
          width: isPortrait ? { ideal: 1080, max: 1920 } : { ideal: 1920, max: 1920 },
          height: isPortrait ? { ideal: 1440, max: 2560 } : { ideal: 1080, max: 1080 },
          aspectRatio: isPortrait ? { ideal: 3 / 4 } : { ideal: 4 / 3 },
        }
      : {
          facingMode: { ideal: 'user' },
          width: isPortrait ? { ideal: 1080, max: 1920 } : { ideal: 1920, max: 1920 },
          height: isPortrait ? { ideal: 1440, max: 2560 } : { ideal: 1080, max: 1080 },
          aspectRatio: isPortrait ? { ideal: 3 / 4 } : { ideal: 4 / 3 },
        }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false })
      streamRef.current = mediaStream
      setStream(mediaStream)

      // After getting permission, enumerate devices (labels are available now)
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
      setDevices(videoDevices)

      // Track active device & auto-detect mirroring for front vs rear camera
      const track = mediaStream.getVideoTracks()[0]
      const currentId = track?.getSettings?.()?.deviceId ?? deviceId ?? null
      const trackLabel = track?.label ?? ''
      setActiveDeviceId(currentId)

      // Rear camera does NOT mirror by default; front camera DOES mirror
      if (isRearCameraDevice(trackLabel)) {
        setIsMirrored(false)
      } else if (trackLabel.toLowerCase().includes('front') || trackLabel.toLowerCase().includes('trước') || trackLabel.toLowerCase().includes('user')) {
        setIsMirrored(true)
      }

      const video = videoRef.current
      if (!video) return

      const onReady = () => {
        setIsReady(true)
        video.removeEventListener('canplay', onReady)
        video.removeEventListener('loadedmetadata', onReady)
      }
      video.addEventListener('canplay', onReady)
      video.addEventListener('loadedmetadata', onReady)

      video.srcObject = mediaStream
      video.play().catch(() => { /* autoplay policy */ })
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
    startCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMirror = useCallback(() => setIsMirrored(m => !m), [])

  const toggleSound = useCallback(() => {
    _soundEnabled = !_soundEnabled
    setSoundEnabled(_soundEnabled)
  }, [])

  const selectDevice = useCallback((deviceId: string) => {
    // Check label of selected device from list
    const found = devices.find(d => d.deviceId === deviceId)
    if (found) {
      if (isRearCameraDevice(found.label)) {
        setIsMirrored(false)
      } else {
        setIsMirrored(true)
      }
    }
    startCamera(deviceId)
  }, [devices, startCamera])

  const retryCamera = useCallback(() => {
    startCamera(activeDeviceId ?? undefined)
  }, [activeDeviceId, startCamera])

  const captureFrame = useCallback((filterCss?: string): string | null => {
    const video = videoRef.current
    if (!video || !isReady || !video.videoWidth || !video.videoHeight) return null

    playShutterSound()

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!

    if (filterCss && filterCss !== 'none') {
      ctx.filter = filterCss
    }
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
    devices,
    activeDeviceId,
    soundEnabled,
    toggleMirror,
    toggleSound,
    captureFrame,
    selectDevice,
    retryCamera,
  }
}
