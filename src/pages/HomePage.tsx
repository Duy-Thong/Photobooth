import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import { useCamera } from '@/hooks/useCamera'
import { useVideoRecap } from '@/hooks/useVideoRecap'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { buildStripImage, buildStripVideo, detectFrameSlots } from '@/lib/imageProcessing'
import { LAYOUTS, FILTERS } from '@/types/photobooth'
import CameraView from '@/components/photobooth/CameraView'
import PhotoStrip from '@/components/photobooth/PhotoStrip'
import TopControls from '@/components/photobooth/TopControls'
import CaptureControls from '@/components/photobooth/CaptureControls'
import FilterPanel from '@/components/photobooth/FilterPanel'
import FrameModal from '@/components/photobooth/FrameModal'
import ResultModal from '@/components/photobooth/ResultModal'

export default function HomePage() {
  const { videoRef, isMirrored, isReady, error, toggleMirror, captureFrame, selectDevice, retryCamera, devices, activeDeviceId } = useCamera()

  const {
    layout, countdown, setCountdown,
    activeFilter, activeEffects, setFilter, toggleEffect,
    capturedSlots, addPhoto, replaceSlot, resetPhotos,
    isCapturing, setIsCapturing,
    finalImageUrl, setFinalImageUrl,
    frameUrl,
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
  const [messageApi, contextHolder] = message.useMessage()

  const abortRef = useRef(false)
  const capturedCount = capturedSlots.filter(Boolean).length

  // Build the combined strip video once we have all clips + a frame
  useEffect(() => {
    if (!finalImageUrl || recapClips.length === 0 || !frameUrl) return
    setRecapStripUrl(null)
    setBuildingStrip(true)
    buildStripVideo(recapClips, frameUrl, 24)
      .then(url => setRecapStripUrl(url))
      .catch(() => {})
      .finally(() => setBuildingStrip(false))
  // Re-run only when finalImageUrl changes (clips + frameUrl are stable at that point)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalImageUrl])

  // ---------- Auto-open frame modal or auto-build when all slots filled ----------
  // If a frame is already chosen, skip the modal and build directly.
  useEffect(() => {
    if (capturedCount !== layout.slots || finalImageUrl || isCapturing) return
    if (frameUrl) {
      // Frame already selected — build with it immediately
      const timer = setTimeout(async () => {
        try {
          const { capturedSlots: cs, layout: l, activeEffects: fx } = usePhotoboothStore.getState()
          const url = await buildStripImage(cs, l, fx, frameUrl)
          setFinalImageUrl(url)
          setResultModalOpen(true)
        } catch { /* noop */ }
      }, 350)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => setFrameModalOpen(true), 350)
      return () => clearTimeout(timer)
    }
  }, [capturedCount, layout.slots, finalImageUrl, isCapturing, frameUrl])

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
    setIsCapturing(true)
    await takeOnePhoto()
    setIsCapturing(false)
  }, [isReady, isCapturing, setIsCapturing, takeOnePhoto])

  // ---------- AUTO — capture all remaining slots ----------
  const handleAutoCapture = useCallback(async () => {
    if (!isReady || isCapturing) return
    abortRef.current = false
    setIsCapturing(true)
    const remaining = capturedSlots.filter(s => s === null).length
    for (let i = 0; i < remaining; i++) {
      if (abortRef.current) break
      await takeOnePhoto()
      if (i < remaining - 1) await new Promise(r => setTimeout(r, 500))
    }
    setIsCapturing(false)
  }, [isReady, isCapturing, setIsCapturing, capturedSlots, takeOnePhoto])

  // ---------- Retake ----------
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
    usePhotoboothStore.getState().setFrameUrl(null)
  }, [resetPhotos, setFinalImageUrl, setIsCapturing, cancelRecording])

  // ---------- Build final strip ----------
  const handleBuildStrip = useCallback(async () => {
    if (capturedSlots.some(s => s === null)) {
      messageApi.warning('Chưa đủ ảnh!')
      return
    }
    try {
      const url = await buildStripImage(capturedSlots, layout, activeEffects, frameUrl)
      setFinalImageUrl(url)
      setResultModalOpen(true)
    } catch {
      messageApi.error('Tạo ảnh thất bại, thử lại nhé!')
    }
  }, [capturedSlots, layout, activeEffects, frameUrl, setFinalImageUrl, messageApi])

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
    addPhoto(dataUrl, false)
    setFinalImageUrl(null)
  }, [addPhoto, setFinalImageUrl])

  return (
    <>
      {contextHolder}
      <FrameModal
        open={frameModalOpen}
        currentLayout={layout}
        selectedFrameUrl={frameUrl}
        onSelect={async (url, frameItem) => {
          // Detect how many transparent slots the frame PNG actually has
          let detectedSlots = 0
          try { detectedSlots = (await detectFrameSlots(url)).length } catch { /* noop */ }

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

          store.setFrameUrl(url)
          setFrameModalOpen(false)
          setFinalImageUrl(null)

          // If all slots are already filled after layout (possibly changed), auto-build
          const refreshed = usePhotoboothStore.getState()
          if (refreshed.capturedSlots.every(s => s !== null)) {
            setTimeout(async () => {
              try {
                const { capturedSlots: cs, activeEffects: fx } = usePhotoboothStore.getState()
                const result = await buildStripImage(cs, targetLayout, fx, url)
                setFinalImageUrl(result)
                setResultModalOpen(true)
              } catch { /* ignore */ }
            }, 0)
          }
        }}
        onClear={() => {
          usePhotoboothStore.getState().setFrameUrl(null)
          setFinalImageUrl(null)
        }}
        onClose={() => setFrameModalOpen(false)}
      />
      <ResultModal
        open={resultModalOpen}
        imageBlobUrl={finalImageUrl}
        recapClips={recapClips}
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
      <div className="min-h-dvh bg-[#0a0a0a] flex flex-col">
        {/* Header */}
        <header className="text-center pt-5 pb-4 border-b border-[#141414]">
          <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
            Sổ Media
          </h1>
          <p className="text-white text-[9px] tracking-[0.35em] uppercase mt-0.5 font-medium">Photobooth</p>
        </header>

        {/* Top controls bar */}
        <div className="border-b border-[#141414] px-4 py-2.5">
          <div className="max-w-5xl mx-auto">
            <TopControls
              countdown={countdown}
              frameUrl={frameUrl}
              onCountdownChange={setCountdown}
              onChooseFrame={() => setFrameModalOpen(true)}
              onClearFrame={() => {
                usePhotoboothStore.getState().setFrameUrl(null)
                setFinalImageUrl(null)
              }}
            />
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 max-w-5xl mx-auto w-full px-3 md:px-4 py-4">
          <div className="flex flex-col md:flex-row gap-3 h-full">
            {/* Left: camera + controls + filters */}
            <div className="flex-1 flex flex-col gap-2.5 min-w-0">
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
              <CaptureControls
                isReady={isReady}
                isCapturing={isCapturing}
                capturedCount={capturedCount}
                totalSlots={layout.slots}
                videoRecap={videoRecap}
                onManualCapture={handleManualCapture}
                onAutoCapture={handleAutoCapture}
                onRetake={handleRetake}
                onUploadAll={handleUploadAll}
                onToggleVideoRecap={setVideoRecap}
              />
              <FilterPanel
                activeFilter={activeFilter}
                activeEffects={activeEffects}
                onFilterChange={setFilter}
                onEffectToggle={toggleEffect}
              />
            </div>

            {/* Right: photo strip — width depends on layout cols, self-start so it doesn't grow to camera height */}
            <div className={`shrink-0 w-full md:self-start ${layout.cols === 2 ? 'md:w-64 lg:w-72' : 'md:w-44 lg:w-48'}`}>
              <PhotoStrip
                layout={layout}
                slots={capturedSlots}
                finalImageUrl={finalImageUrl}
                frameUrl={frameUrl}
                activeEffects={activeEffects}
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
