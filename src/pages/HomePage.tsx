import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import { useCamera } from '@/hooks/useCamera'
import { useVideoRecap } from '@/hooks/useVideoRecap'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { useThemeClass } from '@/stores/themeStore'
import { buildStripImage, buildStripVideo, detectFrameSlots } from '@/lib/imageProcessing'
import { LAYOUTS, FILTERS } from '@/types/photobooth'
import CameraView from '@/components/photobooth/CameraView'
import PhotoStrip from '@/components/photobooth/PhotoStrip'
import CaptureControls from '@/components/photobooth/CaptureControls'
// import FilterPanel from '@/components/photobooth/FilterPanel'
import FrameModal from '@/components/photobooth/FrameModal'
import ResultModal from '@/components/photobooth/ResultModal'
import ContributeFrameModal from '@/components/photobooth/ContributeFrameModal'
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

  const { startRecording, stopRecording, cancelRecording, getVideoMimeType } = useVideoRecap(videoRef, isMirrored)

  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [showFlash, setShowFlash] = useState(false)
  const [videoRecap, setVideoRecap] = useState(false)
  const [recapClips, setRecapClips] = useState<string[]>([])
  const [recapMimeType, setRecapMimeType] = useState<string>('video/webm')
  const [recapStripUrl, setRecapStripUrl] = useState<string | null>(null)
  const [buildingStrip, setBuildingStrip] = useState(false)
  const [frameModalOpen, setFrameModalOpen] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const abortRef = useRef(false)
  const capturedCount = capturedSlots.filter(Boolean).length
  const tc = useThemeClass()

  useEffect(() => {
    if (!selectedFrame) {
      const timer = setTimeout(() => setFrameModalOpen(true), 300)
      return () => clearTimeout(timer)
    }
  }, [selectedFrame])

  // Build the combined strip video once we have all clips + a frame
  useEffect(() => {
    if (!finalImageUrl || recapClips.length === 0 || !selectedFrame) return
    setRecapStripUrl(null)
    setBuildingStrip(true)
    const fUrl = selectedFrame.storageUrl ?? `/frames/${selectedFrame.filename}`
    buildStripVideo(recapClips, fUrl, selectedFrame.slots_data, 24, isX2)
      .then(url => setRecapStripUrl(url))
      .catch(() => {})
      .finally(() => setBuildingStrip(false))
  // Re-run only when finalImageUrl changes (clips + frameUrl are stable at that point)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalImageUrl])

  // Auto-open frame modal only if no frame selected. 
  // Auto-build is now DISABLED per user request (manual only).
  useEffect(() => {
    if (capturedCount !== layout.slots || finalImageUrl || isCapturing) return
    if (!selectedFrame) {
      const timer = setTimeout(() => setFrameModalOpen(true), 350)
      return () => clearTimeout(timer)
    }
  }, [capturedCount, layout.slots, finalImageUrl, isCapturing, selectedFrame])

  // ---------- Single shot with countdown ----------
  // If videoRecap is on: start recording when countdown begins, stop when photo is taken.
  // This produces one clip per slot.
  const takeOnePhoto = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
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
              if (url) {
                setRecapClips(prev => [...prev, url])
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
  }, [countdown, captureFrame, addPhoto, videoRecap, startRecording, stopRecording, getVideoMimeType, activeFilter])

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
    setRecapClips([])
    setRecapMimeType('video/webm')
    setRecapStripUrl(null)
    setBuildingStrip(false)
    resetPhotos()
    setFinalImageUrl(null)
    setCountdownValue(null)
  }, [resetPhotos, setFinalImageUrl, setIsCapturing, cancelRecording])

  // ---------- Build final strip ----------
  const handleBuildStrip = useCallback(async () => {
    if (capturedSlots.some(s => s === null)) {
      messageApi.warning('Chưa đủ ảnh!')
      return
    }
    try {
      if (videoRecap) setBuildingStrip(true)
      const fUrl = selectedFrame ? (selectedFrame.storageUrl ?? `/frames/${selectedFrame.filename}`) : null
      const url = await buildStripImage(capturedSlots, layout, activeEffects, fUrl, selectedFrame?.slots_data, isX2)
      setFinalImageUrl(url)
      setResultModalOpen(true)
    } catch {
      messageApi.error('Tạo ảnh thất bại, thử lại nhé!')
    }
  }, [capturedSlots, layout, activeEffects, selectedFrame, setFinalImageUrl, messageApi])

  // ---------- Download / Show Result ----------
  const handleDownload = useCallback(() => {
    if (finalImageUrl) setResultModalOpen(true)
  }, [finalImageUrl])

  // ---------- Slot management ----------
  const handleUploadSlot = useCallback((index: number, dataUrl: string) => {
    replaceSlot(index, dataUrl)
    setFinalImageUrl(null)
  }, [replaceSlot, setFinalImageUrl])

  const handleRemoveSlot = useCallback((index: number) => {
    usePhotoboothStore.setState(s => {
      const next = [...s.capturedSlots]
      next[index] = null
      return { capturedSlots: next, finalImageUrl: null }
    })
  }, [])

  const handleUploadAll = useCallback((dataUrl: string) => {
    if (!selectedFrame) {
      messageApi.warning('Vui lòng chọn khung ảnh trước khi tải ảnh!')
      setFrameModalOpen(true)
      return
    }
    addPhoto(dataUrl, false)
    setFinalImageUrl(null)
  }, [selectedFrame, addPhoto, setFinalImageUrl, messageApi])

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

          // Find best matching layout
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
              }
              messageApi.info(`Đã chuyển layout sang ${match.label} để khớp với khung (${detectedSlots} ảnh)`)
              targetLayout = match
            }
          }

          setSelectedFrame(frameItem)
          setFrameModalOpen(false)
          setFinalImageUrl(null)
          
          // If all slots are already filled after layout (possibly changed), auto-build
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
      />
      <div className={`min-h-dvh md:h-dvh md:max-h-dvh md:overflow-hidden flex flex-col ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
        {/* Header - slim & centered */}
        <header className={`py-2 px-4 sm:px-8 border-b shrink-0 relative flex items-center justify-between ${tc('border-[#141414]', 'border-[#e0e0e0]')}`}>
          <div className="w-8" />
          <div className="text-center">
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${tc('text-white', 'text-black')}`} style={{ letterSpacing: '-0.03em' }}>
              Sổ Media
            </h1>
            <p className={`text-[8px] sm:text-[9px] tracking-[0.35em] uppercase font-medium ${tc('text-[#888]', 'text-[#666]')}`}>
              Photobooth
            </p>
          </div>
          <div>
            <ThemeToggle />
          </div>
        </header>

        {/* Main Studio Area - Full Width Stretch & Generous Preview */}
        <div className="flex-1 min-h-0 w-full max-w-[1640px] mx-auto px-2 sm:px-4 lg:px-6 py-2 md:overflow-hidden">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-5 h-full items-start">
            {/* Left: camera (takes available vertical space) + unified capture controls (shrink-0) */}
            <div className="flex-1 flex flex-col gap-2 h-full min-h-0 min-w-0">
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
              <div className="shrink-0 w-full">
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
                  onToggleVideoRecap={setVideoRecap}
                  onChooseFrame={() => setFrameModalOpen(true)}
                  onClearFrame={() => {
                    setSelectedFrame(null)
                    setFinalImageUrl(null)
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

            {/* Right: photo strip — wider and comfortable preview */}
            <div className={`shrink-0 w-full md:self-start pb-4 md:pb-0 ${layout.cols === 2 ? 'md:w-80 lg:w-96 xl:w-[420px]' : 'md:w-52 lg:w-60 xl:w-64'}`}>
              <PhotoStrip
                layout={layout}
                slots={capturedSlots}
                finalImageUrl={finalImageUrl}
                selectedFrame={selectedFrame}
                activeEffects={activeEffects}
                stream={stream}
                isMirrored={isMirrored}
                isCapturing={isCapturing}
                onUploadSlot={handleUploadSlot}
                onRemoveSlot={handleRemoveSlot}
                onDownload={handleDownload}
                onBuildStrip={handleBuildStrip}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
