import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import {
  SyncOutlined,
  UndoOutlined,
  UploadOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  MutedOutlined,
} from '@ant-design/icons'
import { useCamera } from '@/hooks/useCamera'
import { useVideoRecap } from '@/hooks/useVideoRecap'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { useThemeClass } from '@/stores/themeStore'
import { buildStripImage, buildStripVideo, detectFrameSlots } from '@/lib/imageProcessing'
import { LAYOUTS, FILTERS, COUNTDOWN_OPTIONS } from '@/types/photobooth'
import CameraView from '@/components/photobooth/CameraView'
import PhotoStrip from '@/components/photobooth/PhotoStrip'
import CaptureControls from '@/components/photobooth/CaptureControls'
import FrameModal from '@/components/photobooth/FrameModal'
import ResultModal from '@/components/photobooth/ResultModal'
import ContributeFrameModal from '@/components/photobooth/ContributeFrameModal'
import PrivacyNoticeModal from '@/components/photobooth/PrivacyNoticeModal'
import ThemeToggle from '@/components/photobooth/ThemeToggle'

export default function HomePage() {
  const { videoRef, stream, isMirrored, isReady, error, toggleMirror, captureFrame, selectDevice, retryCamera, devices, activeDeviceId, soundEnabled, toggleSound } = useCamera()

  const {
    layout, countdown, setCountdown,
    activeFilter, activeEffects, /* setFilter, toggleEffect, */
    capturedSlots, addPhoto, replaceSlot, resetPhotos,
    isCapturing, setIsCapturing,
    finalImageUrl, setFinalImageUrl,
    selectedFrame, setSelectedFrame,
    isX2, setIsX2,
  } = usePhotoboothStore()

  const isWideStrip =
    isX2 ||
    layout.cols >= 2 ||
    Boolean(selectedFrame?.layout && ['2x2', '2x3', '2x4'].includes(selectedFrame.layout)) ||
    Boolean(
      (selectedFrame?.frame === 'grid' || selectedFrame?.frame === 'bigrectangle') &&
      !['1x4', '1x3', '1x2'].includes(selectedFrame?.layout ?? '')
    )

  const { startRecording, stopRecording, cancelRecording, getVideoMimeType } = useVideoRecap(videoRef, isMirrored)

  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [showFlash, setShowFlash] = useState(false)
  const [videoRecap, setVideoRecap] = useState(false)
  const [recapClips, setRecapClips] = useState<(string | null)[]>([])
  const [recapMimeType, setRecapMimeType] = useState<string>('video/webm')
  const [recapStripUrl, setRecapStripUrl] = useState<string | null>(null)
  const [buildingStrip, setBuildingStrip] = useState(false)
  const [frameModalOpen, setFrameModalOpen] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const abortRef = useRef(false)
  const capturedCount = capturedSlots.filter(Boolean).length
  const tc = useThemeClass()

  // Responsive mobile mode tracking
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Desktop camera + controls unified deck width sync (1 cohesive unit at 16:9, tight to strip)
  const studioRef = useRef<HTMLDivElement>(null)
  const stripColRef = useRef<HTMLDivElement>(null)
  const [desktopDeckWidth, setDesktopDeckWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = studioRef.current
    if (!el) return

    const update = () => {
      const style = window.getComputedStyle(el)
      const padLeft = parseFloat(style.paddingLeft || '0')
      const padRight = parseFloat(style.paddingRight || '0')
      const padTop = parseFloat(style.paddingTop || '0')
      const padBottom = parseFloat(style.paddingBottom || '0')
      const usableWidth = el.clientWidth - padLeft - padRight
      const usableHeight = el.clientHeight - padTop - padBottom
      if (usableWidth <= 0 || usableHeight <= 0) return

      const stripRect = stripColRef.current?.getBoundingClientRect()
      const stripW = stripRect && stripRect.width > 0 ? stripRect.width : (isWideStrip ? 384 : 256)
      const gap = 20 // gap-3 sm:gap-5
      // Leave at least 24px buffer so the strip column never touches the edge or gets clipped
      const maxCamW = Math.max(300, usableWidth - stripW - gap - 24)
      // CaptureControls is ~56px, gap is 8px, leave safety buffer 16px -> 80px
      const maxCamH = Math.max(0, usableHeight - 80)
      const idealW = maxCamH * (16 / 9)
      const w = Math.min(maxCamW, idealW)
      setDesktopDeckWidth(Math.round(w))
    }

    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (stripColRef.current) ro.observe(stripColRef.current)
    update()
    return () => ro.disconnect()
  }, [isWideStrip])

  const mobileUploadRef = useRef<HTMLInputElement>(null)
  const handleMobileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => handleUploadAll(ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Helper to clear & revoke all video recap clips
  const clearRecapClips = useCallback(() => {
    setRecapClips(prev => {
      prev.forEach(url => { if (url) URL.revokeObjectURL(url) })
      return []
    })
    setRecapStripUrl(null)
    setBuildingStrip(false)
  }, [])

  const handleToggleVideoRecap = useCallback((enabled: boolean) => {
    setVideoRecap(enabled)
    if (!enabled) {
      clearRecapClips()
    }
  }, [clearRecapClips])

  // First time visit privacy notice popup
  useEffect(() => {
    const accepted = localStorage.getItem('somedia_privacy_accepted')
    if (!accepted) {
      setPrivacyModalOpen(true)
    }
  }, [])

  const handleClosePrivacyModal = () => {
    localStorage.setItem('somedia_privacy_accepted', 'true')
    setPrivacyModalOpen(false)
  }

  // Build the combined strip video once we have all clips + a frame
  useEffect(() => {
    // Only build if videoRecap is active, final image exists, frame is selected,
    // and all slots have valid non-null video clips matching the layout slot count.
    if (!videoRecap || !finalImageUrl || !selectedFrame) {
      setRecapStripUrl(null)
      return
    }
    if (recapClips.length !== layout.slots || recapClips.some(c => !c)) {
      setRecapStripUrl(null)
      return
    }

    setRecapStripUrl(null)
    setBuildingStrip(true)
    const fUrl = selectedFrame.storageUrl ?? `/frames/${selectedFrame.filename}`
    const validClips = recapClips as string[]
    buildStripVideo(validClips, fUrl, selectedFrame.slots_data, 24, isX2)
      .then(url => setRecapStripUrl(url))
      .catch(() => { })
      .finally(() => setBuildingStrip(false))
    // Re-run only when finalImageUrl changes (clips + frameUrl are stable at that point)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalImageUrl, videoRecap, recapClips, selectedFrame, layout.slots, isX2])

  // Auto-open frame modal immediately on page entry if no frame is selected yet
  useEffect(() => {
    if (!selectedFrame) {
      const timer = setTimeout(() => setFrameModalOpen(true), 300)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open frame modal after shooting all slots if still no frame selected
  useEffect(() => {
    if (capturedCount !== layout.slots || finalImageUrl || isCapturing) return
    if (!selectedFrame) {
      const timer = setTimeout(() => setFrameModalOpen(true), 350)
      return () => clearTimeout(timer)
    }
  }, [capturedCount, layout.slots, finalImageUrl, isCapturing, selectedFrame])

  // ---------- Single shot with countdown ----------
  // If videoRecap is on: start recording when countdown begins, stop when photo is taken.
  // This produces one clip per slot, stored at the exact slot index.
  const takeOnePhoto = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      // Use getState() to read fresh capturedSlots — capturedSlots from the hook closure
      // would be stale when takeOnePhoto is called repeatedly inside handleAutoCapture loop
      const targetIndex = usePhotoboothStore.getState().capturedSlots.findIndex(s => s === null)
      if (videoRecap) startRecording(30)
      let count = countdown
      setCountdownValue(count)
      const tick = setInterval(() => {
        count--
        if (count <= 0) {
          clearInterval(tick)
          setCountdownValue(null)
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 150)
          const filterCss = FILTERS.find(f => f.value === activeFilter)?.css
          const dataUrl = captureFrame(filterCss !== 'none' ? filterCss : undefined)
          if (dataUrl) addPhoto(dataUrl, true)
          if (videoRecap) {
            stopRecording().then(url => {
              if (url && targetIndex !== -1) {
                setRecapClips(prev => {
                  const next = [...prev]
                  while (next.length < layout.slots) next.push(null)
                  if (next[targetIndex]) URL.revokeObjectURL(next[targetIndex]!)
                  next[targetIndex] = url
                  return next
                })
                setRecapMimeType(getVideoMimeType())
              }
              resolve()
            })
          } else {
            resolve()
          }
        } else {
          setCountdownValue(count)
        }
      }, 1000)
    })
  }, [countdown, captureFrame, addPhoto, videoRecap, startRecording, stopRecording, getVideoMimeType, activeFilter, layout.slots])

  // ---------- Manual single capture ----------
  const handleManualCapture = useCallback(async () => {
    if (!isReady || isCapturing) return
    if (!selectedFrame) {
      messageApi.warning('Vui lòng chọn khung ảnh trước khi chụp!')
      setFrameModalOpen(true)
      return
    }
    setIsCapturing(true)
    await takeOnePhoto()
    setIsCapturing(false)
  }, [isReady, isCapturing, selectedFrame, setIsCapturing, takeOnePhoto, messageApi])

  // ---------- AUTO — capture all remaining slots ----------
  const handleAutoCapture = useCallback(async () => {
    if (!isReady || isCapturing) return
    if (!selectedFrame) {
      messageApi.warning('Vui lòng chọn khung ảnh trước khi chụp!')
      setFrameModalOpen(true)
      return
    }
    abortRef.current = false
    setIsCapturing(true)
    const remaining = capturedSlots.filter(s => s === null).length
    for (let i = 0; i < remaining; i++) {
      if (abortRef.current) break
      await takeOnePhoto()
      if (i < remaining - 1) await new Promise(r => setTimeout(r, 500))
    }
    setIsCapturing(false)
  }, [isReady, isCapturing, selectedFrame, setIsCapturing, capturedSlots, takeOnePhoto, messageApi])

  // ---------- Retake (keeps the chosen frame) ----------
  const handleRetake = useCallback(() => {
    abortRef.current = true
    setIsCapturing(false)
    cancelRecording()
    clearRecapClips()
    setRecapMimeType('video/webm')
    resetPhotos()
    setFinalImageUrl(null)
    setCountdownValue(null)
  }, [resetPhotos, setFinalImageUrl, setIsCapturing, cancelRecording, clearRecapClips])

  // ---------- Build final strip ----------
  const handleBuildStrip = useCallback(async () => {
    if (capturedSlots.some(s => s === null)) {
      messageApi.warning('Chưa đủ ảnh!')
      return
    }
    try {
      setBuildingStrip(true)
      const fUrl = selectedFrame ? (selectedFrame.storageUrl ?? `/frames/${selectedFrame.filename}`) : null
      const url = await buildStripImage(capturedSlots, layout, activeEffects, fUrl, selectedFrame?.slots_data, isX2)
      setFinalImageUrl(url)
      setResultModalOpen(true)
    } catch (err) {
      console.error('[buildStripImage error]', err)
      messageApi.error('Tạo ảnh thất bại, thử lại nhé!')
    } finally {
      setBuildingStrip(false)
    }
  }, [capturedSlots, layout, activeEffects, selectedFrame, isX2, setFinalImageUrl, messageApi])

  // ---------- Download / Show Result ----------
  const handleDownload = useCallback(() => {
    if (finalImageUrl) setResultModalOpen(true)
  }, [finalImageUrl])

  // ---------- Slot management ----------
  const handleUploadSlot = useCallback((index: number, dataUrl: string) => {
    replaceSlot(index, dataUrl)
    setFinalImageUrl(null)
    // Uploaded photo does not have a video clip, revoke & clear this slot's clip
    setRecapClips(prev => {
      const next = [...prev]
      if (next[index]) {
        URL.revokeObjectURL(next[index]!)
        next[index] = null
      }
      return next
    })
    setRecapStripUrl(null)
  }, [replaceSlot, setFinalImageUrl])

  const handleRemoveSlot = useCallback((index: number) => {
    usePhotoboothStore.setState(s => {
      const next = [...s.capturedSlots]
      next[index] = null
      return { capturedSlots: next, finalImageUrl: null }
    })
    // Revoke & clear this slot's clip
    setRecapClips(prev => {
      const next = [...prev]
      if (next[index]) {
        URL.revokeObjectURL(next[index]!)
        next[index] = null
      }
      return next
    })
    setRecapStripUrl(null)
  }, [])

  const handleUploadAll = useCallback((dataUrl: string) => {
    if (!selectedFrame) {
      messageApi.warning('Vui lòng chọn khung ảnh trước khi tải ảnh!')
      setFrameModalOpen(true)
      return
    }
    addPhoto(dataUrl, false)
    setFinalImageUrl(null)
    clearRecapClips()
  }, [selectedFrame, addPhoto, setFinalImageUrl, clearRecapClips, messageApi])

  return (
    <>
      {contextHolder}
      <ContributeFrameModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
      <FrameModal
        open={frameModalOpen}
        currentLayout={layout}
        selectedFrame={selectedFrame}
        onSelect={async (url, frameItem) => {
          // Use pre-calculated slots if available, otherwise detect
          let detectedSlots = frameItem.slots_data ? frameItem.slots_data.length : 0
          if (detectedSlots === 0) {
            try { detectedSlots = (await detectFrameSlots(url)).length } catch { /* noop */ }
          }

          // Read fresh state after async detectFrameSlots — getState() is the correct
          // Zustand pattern here because the hook-closure value may be stale post-await
          const store = usePhotoboothStore.getState()
          let targetLayout = store.layout
          if (detectedSlots > 0) {
            const match = LAYOUTS.find(l => l.slots === detectedSlots && (
              // For 4-slot frames: pick 2×2 if grid type, else 1×4
              // For 6-slot frames: pick 2×3 (always 2 cols)
              detectedSlots === 4
                ? (frameItem.frame === 'grid' ? l.cols === 2 : l.cols === 1)
                : detectedSlots === 6
                  ? l.cols === 2
                  : true
            )) ?? LAYOUTS.find(l => l.slots === detectedSlots)
            if (match && match.type !== store.layout.type) {
              if (match.slots === store.layout.slots) {
                // Same slot count, different arrangement — keep photos
                store.setLayoutKeepPhotos(match)
              } else {
                // Slot count changed — must reset photos
                store.setLayout(match)
                store.setFinalImageUrl(null)
                clearRecapClips()
              }
              messageApi.info(`Đã chuyển layout sang ${match.label} để khớp với khung (${detectedSlots} ảnh)`)
              targetLayout = match
            }
          }

          setSelectedFrame(frameItem)
          setFrameModalOpen(false)
          setFinalImageUrl(null)
          setRecapStripUrl(null)

          // Re-read state after potential layout/photo mutations above to check if auto-build applies
          const refreshed = usePhotoboothStore.getState()
          if (refreshed.capturedSlots.every(s => s !== null)) {
            setTimeout(async () => {
              try {
                const { capturedSlots: cs, activeEffects: fx, isX2: currentX2 } = usePhotoboothStore.getState()
                if (videoRecap) setBuildingStrip(true)
                const result = await buildStripImage(cs, targetLayout, fx, url, frameItem.slots_data, currentX2)
                setFinalImageUrl(result)
                setResultModalOpen(true)
              } catch { /* ignore */ }
            }, 0)
          }
        }}
        onClear={() => {
          setSelectedFrame(null)
          setFinalImageUrl(null)
          clearRecapClips()
        }}
        onClose={() => setFrameModalOpen(false)}
      />
      <ResultModal
        open={resultModalOpen}
        imageBlobUrl={finalImageUrl}
        recapMimeType={recapMimeType}
        recapStripUrl={recapStripUrl}
        buildingStrip={buildingStrip}
        onClose={() => setResultModalOpen(false)}
        onRetake={() => {
          handleRetake()
          setResultModalOpen(false)
        }}
        onChangeFrame={() => {
          setResultModalOpen(false)
          setTimeout(() => setFrameModalOpen(true), 150)
        }}
        onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
      />

      <PrivacyNoticeModal
        open={privacyModalOpen}
        onClose={handleClosePrivacyModal}
      />

      <div className={`h-dvh max-h-dvh overflow-hidden flex flex-col ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
        {/* Header - slim & centered */}
        <header className={`py-1.5 md:py-2 px-3 sm:px-8 border-b shrink-0 relative flex items-center justify-between ${tc('border-[#141414]', 'border-[#e0e0e0]')}`}>
          <div className="w-8 hidden sm:block" />

          {/* Title - Absolutely Centered */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <a href="/" className="pointer-events-auto">
              <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${tc('text-white', 'text-black')}`} style={{ letterSpacing: '-0.03em' }}>
                Sổ Media
              </h1>
              <p className={`text-[8px] sm:text-[9px] tracking-[0.35em] uppercase font-medium ${tc('text-[#888]', 'text-[#666]')}`}>
                Photobooth
              </p>
            </a>
          </div>

          {/* Theme Toggle Right */}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Background Headless Camera Feed (so captureFrame and videoRecap work flawlessly) */}
        {isMobile && (
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            muted
            className="fixed -top-[9999px] -left-[9999px] w-[640px] h-[480px] opacity-0 pointer-events-none"
            style={{
              transform: isMirrored ? 'scaleX(-1)' : 'none',
            }}
          />
        )}

        {/* Main Studio Area */}
        <div ref={studioRef} className="flex-1 h-full w-full max-w-[1640px] mx-auto px-2 sm:px-4 lg:px-6 py-1 md:py-2 overflow-hidden flex flex-col justify-between min-h-0">
          {/* ══════════════ DESKTOP VIEW (md:flex) ══════════════ */}
          <div className="hidden md:flex flex-row gap-3 sm:gap-5 h-full items-center justify-center max-w-full min-w-0 mx-auto">
            {/* Left: camera + unified capture controls (1 cohesive deck) */}
            <div
              style={{ width: desktopDeckWidth ? `${desktopDeckWidth}px` : undefined }}
              className="flex flex-col gap-2 shrink-0 items-center justify-center max-w-full transition-all duration-150"
            >
              <div className="w-full shrink-0">
                <CameraView
                  videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                  isMirrored={isMirrored}
                  isReady={isReady}
                  error={error}
                  activeFilter={activeFilter}
                  capturedCount={capturedCount}
                  totalSlots={layout.slots}
                  countdownValue={countdownValue}
                  showFlash={showFlash}
                  devices={devices}
                  activeDeviceId={activeDeviceId}
                  onSelectDevice={selectDevice}
                  onToggleMirror={toggleMirror}
                  onRetry={retryCamera}
                />
              </div>
              <div className="w-full shrink-0">
                <CaptureControls
                  isReady={isReady}
                  isCapturing={isCapturing}
                  countdown={countdown}
                  capturedCount={capturedCount}
                  totalSlots={layout.slots}
                  videoRecap={videoRecap}
                  selectedFrame={selectedFrame}
                  soundEnabled={soundEnabled}
                  onManualCapture={handleManualCapture}
                  onAutoCapture={handleAutoCapture}
                  onRetake={handleRetake}
                  onUploadAll={handleUploadAll}
                  onToggleVideoRecap={handleToggleVideoRecap}
                  onChooseFrame={() => setFrameModalOpen(true)}
                  onClearFrame={() => {
                    setSelectedFrame(null)
                    setFinalImageUrl(null)
                    clearRecapClips()
                  }}
                  onContributeFrame={() => setContributeOpen(true)}
                  onCountdownChange={setCountdown}
                  onToggleSound={toggleSound}
                  isX2={isX2}
                  onToggleX2={setIsX2}
                  layout={layout}
                />
              </div>
            </div>

            {/* Right: photo strip */}
            <div
              ref={stripColRef}
              className={`shrink-0 md:h-full md:self-stretch pb-6 md:pb-0 flex flex-col justify-center items-center min-h-0 transition-all duration-300 ${
                isWideStrip 
                  ? 'md:w-72 lg:w-80 xl:w-96' 
                  : 'md:w-52 lg:w-60 xl:w-64'
              }`}
            >
              <PhotoStrip
                layout={layout}
                slots={capturedSlots}
                finalImageUrl={finalImageUrl}
                selectedFrame={selectedFrame}
                activeEffects={activeEffects}
                stream={stream}
                isMirrored={isMirrored}
                isCapturing={isCapturing}
                countdownValue={countdownValue}
                showFlash={showFlash}
                onUploadSlot={handleUploadSlot}
                onRemoveSlot={handleRemoveSlot}
                onDownload={handleDownload}
                onBuildStrip={handleBuildStrip}
              />
            </div>
          </div>

          {/* ══════════════ MOBILE FRAME-FIRST STUDIO (flex md:hidden) ══════════════ */}
          <div className="flex md:hidden flex-col h-full justify-between items-center w-full overflow-hidden min-h-0 pb-1">
            {/* Mobile Top Tools: Camera Flip & Mirror */}
            <div className="w-full flex items-center justify-between px-1 py-0.5 shrink-0">
              <div className="flex items-center gap-1.5">
                {devices.length > 1 && (
                  <div className="relative inline-flex items-center">
                    <select
                      value={activeDeviceId ?? ''}
                      onChange={e => selectDevice(e.target.value)}
                      title="Chọn camera"
                      className={`h-8 pl-6.5 pr-5 rounded-xl border text-[11px] font-bold transition active:scale-95 cursor-pointer shadow-xs appearance-none outline-none max-w-[130px] truncate ${tc(
                        'bg-[#141414] border-[#282828] text-white',
                        'bg-white border-[#d8d8d8] text-black'
                      )}`}
                    >
                      {devices.map((d, i) => (
                        <option
                          key={d.deviceId}
                          value={d.deviceId}
                          className={tc('bg-[#141414] text-white', 'bg-white text-black')}
                        >
                          {d.label ? (d.label.length > 16 ? d.label.slice(0, 14) + '…' : d.label) : `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                    <SyncOutlined className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] opacity-70" />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] opacity-60">▾</span>
                  </div>
                )}

                <button
                  onClick={toggleMirror}
                  title="Lật gương camera"
                  className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs ${tc(
                    'bg-[#141414] border-[#282828] text-white',
                    'bg-white border-[#d8d8d8] text-black'
                  )}`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zm0 8h2v-2h-2v2zm0-4h2v-2h-2v2zm-4 8h2v-2h-2v2zM5 3H3v18h2V3zm4 18h2v-2H9v2zm8-16V3l-4 4 4 4V7h2V5h-2zm-8 0h2V3H9v2z" />
                  </svg>
                  <span className="text-[11px] font-bold">{isMirrored ? 'Đang lật' : 'Gương'}</span>
                </button>
              </div>

              {/* Progress badge */}
              <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-wider ${tc('bg-[#141414] border-[#262626] text-white/80', 'bg-white border-[#e0e0e0] text-black/80')}`}>
                {capturedCount} / {layout.slots} ảnh
              </div>
            </div>

            {/* Mobile Hero: PhotoStrip as Viewfinder */}
            <div className="flex-1 h-full w-full flex flex-col justify-start items-center pt-0.5 pb-1 overflow-hidden min-h-0">
              <PhotoStrip
                layout={layout}
                slots={capturedSlots}
                finalImageUrl={finalImageUrl}
                selectedFrame={selectedFrame}
                activeEffects={activeEffects}
                stream={stream}
                isMirrored={isMirrored}
                isCapturing={isCapturing}
                countdownValue={countdownValue}
                showFlash={showFlash}
                onUploadSlot={handleUploadSlot}
                onRemoveSlot={handleRemoveSlot}
                onDownload={handleDownload}
                onBuildStrip={handleBuildStrip}
              />
            </div>

            {/* Mobile Bottom Deck: Quick Settings + Shutter */}
            <div className="w-full flex flex-col gap-1.5 shrink-0 pt-0.5 pb-1.5">
              {/* Row 1: Quick Settings Pill Bar */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                {/* Frame Picker */}
                <button
                  onClick={() => setFrameModalOpen(true)}
                  disabled={isCapturing}
                  className={`h-8.5 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer shadow-xs ${
                    selectedFrame
                      ? tc('bg-[#161616] border-[#333] text-white', 'bg-white border-[#ccc] text-black')
                      : tc('bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse', 'bg-amber-100 border-amber-400 text-amber-900 animate-pulse')
                  }`}
                >
                  <span>🖼️</span>
                  <span className="truncate max-w-[85px]">{selectedFrame?.name || 'Chọn khung'}</span>
                  <span className="text-[8px] opacity-60">▾</span>
                </button>

                {/* Countdown Timer Pill */}
                <button
                  onClick={() => {
                    const curIdx = COUNTDOWN_OPTIONS.indexOf(countdown)
                    const next = COUNTDOWN_OPTIONS[(curIdx + 1) % COUNTDOWN_OPTIONS.length]
                    setCountdown(next)
                  }}
                  disabled={isCapturing}
                  className={`h-8.5 px-2.5 rounded-xl border text-[11px] font-bold shrink-0 flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs ${
                    countdown > 0
                      ? tc('bg-white text-black border-white', 'bg-black text-white border-black')
                      : tc('bg-[#141414] border-[#262626] text-[#888]', 'bg-white border-[#d8d8d8] text-[#666]')
                  }`}
                  title="Chạm để đổi số giây đếm ngược"
                >
                  <span>⏱️</span>
                  <span>{countdown}s</span>
                </button>

                {/* Video Recap Pill */}
                <button
                  onClick={() => {
                    if (countdown > 0 && !isCapturing) {
                      handleToggleVideoRecap(!videoRecap)
                    }
                  }}
                  disabled={countdown === 0 || isCapturing}
                  className={`h-8.5 px-2 rounded-xl border text-[11px] font-bold shrink-0 flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs ${
                    videoRecap && countdown > 0
                      ? tc('bg-[#0a0a0a] border-[#4da6ff] text-[#4da6ff] shadow-[0_0_10px_rgba(77,166,255,0.3)]', 'bg-white border-[#4da6ff] text-[#4da6ff] shadow-[0_0_10px_rgba(77,166,255,0.3)]')
                      : tc('bg-[#141414] border-[#262626] text-[#888]', 'bg-white border-[#d8d8d8] text-[#777]')
                  }`}
                >
                  <VideoCameraOutlined style={{ fontSize: 12 }} />
                  <span>Video</span>
                  <span className={`text-[8px] font-black px-1 rounded ${videoRecap && countdown > 0 ? 'bg-[#4da6ff] text-black' : 'bg-gray-800 text-gray-400'}`}>
                    {videoRecap && countdown > 0 ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* x2 Pill */}
                {layout.cols === 1 && layout.slots > 1 && (
                  <button
                    onClick={() => setIsX2(!isX2)}
                    disabled={isCapturing}
                    className={`h-8.5 px-2 rounded-xl border text-[11px] font-black shrink-0 transition active:scale-95 cursor-pointer shadow-xs ${
                      isX2
                        ? tc('bg-[#0a0a0a] border-[#ff9f4d] text-[#ff9f4d]', 'bg-white border-[#ff9f4d] text-[#ff9f4d]')
                        : tc('bg-[#141414] border-[#262626] text-[#888]', 'bg-white border-[#d8d8d8] text-[#777]')
                    }`}
                  >
                    x2
                  </button>
                )}

                {/* Sound Pill */}
                <button
                  onClick={toggleSound}
                  disabled={isCapturing}
                  className={`w-8.5 h-8.5 rounded-xl border shrink-0 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
                    soundEnabled
                      ? tc('bg-[#1a1a1a] border-white/20 text-white', 'bg-white border-black/20 text-black')
                      : tc('bg-[#141414] border-[#262626] text-[#666]', 'bg-white border-[#d8d8d8] text-[#999]')
                  }`}
                >
                  {soundEnabled ? <SoundOutlined style={{ fontSize: 12 }} /> : <MutedOutlined style={{ fontSize: 12 }} />}
                </button>
              </div>

              {/* Row 2: Shutter Action Bar */}
              <div className="flex items-center justify-between gap-2 pt-0.5 px-0.5">
                {/* Retake & Upload Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleRetake}
                    disabled={capturedCount === 0 || isCapturing}
                    title="Chụp lại từ đầu"
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
                      capturedCount === 0 || isCapturing
                        ? 'opacity-30 pointer-events-none'
                        : tc('bg-[#141414] border-[#262626] text-white', 'bg-white border-[#d8d8d8] text-black')
                    }`}
                  >
                    <UndoOutlined style={{ fontSize: 15 }} />
                  </button>

                  <button
                    onClick={() => mobileUploadRef.current?.click()}
                    disabled={isCapturing}
                    title="Tải ảnh lên"
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${tc(
                      'bg-[#141414] border-[#262626] text-white',
                      'bg-white border-[#d8d8d8] text-black'
                    )}`}
                  >
                    <UploadOutlined style={{ fontSize: 15 }} />
                  </button>
                  <input ref={mobileUploadRef} type="file" accept="image/*" className="hidden" onChange={handleMobileUpload} disabled={isCapturing} />
                </div>

                {/* Center: Main Shutter Button or Finish Button */}
                {capturedCount === layout.slots || finalImageUrl ? (
                  <button
                    onClick={finalImageUrl ? handleDownload : handleBuildStrip}
                    disabled={buildingStrip}
                    className={`flex-1 h-12 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 ${tc(
                      'bg-white text-black hover:bg-gray-100 shadow-[0_0_20px_rgba(255,255,255,0.2)]',
                      'bg-black text-white hover:bg-gray-900 shadow-[0_0_20px_rgba(0,0,0,0.2)]'
                    )}`}
                  >
                    {buildingStrip ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>ĐANG TẠO ẢNH...</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>NHẬN ẢNH ({capturedCount}/{layout.slots})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleManualCapture}
                    disabled={!isReady || isCapturing}
                    className={`flex-1 h-12 rounded-2xl font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xl ${
                      !isReady || isCapturing
                        ? 'opacity-40 cursor-not-allowed'
                        : tc('bg-white text-black hover:bg-gray-100', 'bg-black text-white hover:bg-gray-900')
                    }`}
                  >
                    {isCapturing ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      </span>
                    )}
                    <span>{isCapturing ? 'ĐANG CHỤP...' : `CHỤP (${capturedCount + 1}/${layout.slots})`}</span>
                  </button>
                )}

                {/* AUTO Shoot Button */}
                <button
                  onClick={handleAutoCapture}
                  disabled={!isReady || isCapturing || capturedCount === layout.slots}
                  className={`h-11 px-3.5 rounded-2xl border font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs shrink-0 ${
                    !isReady || isCapturing || capturedCount === layout.slots
                      ? 'opacity-30 pointer-events-none'
                      : tc('bg-[#181818] border-[#333] text-white hover:bg-[#222]', 'bg-[#f0f0f0] border-[#ccc] text-black hover:bg-[#e4e4e4]')
                  }`}
                >
                  <span>⚡</span>
                  <span>AUTO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
