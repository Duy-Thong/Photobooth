import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import { useCamera } from '@/hooks/useCamera'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { buildStripImage, downloadImage } from '@/lib/imageProcessing'
import CameraView from '@/components/photobooth/CameraView'
import PhotoStrip from '@/components/photobooth/PhotoStrip'
import TopControls from '@/components/photobooth/TopControls'
import CaptureControls from '@/components/photobooth/CaptureControls'
import FilterPanel from '@/components/photobooth/FilterPanel'
import FrameModal from '@/components/photobooth/FrameModal'

export default function HomePage() {
  const { videoRef, isMirrored, isReady, error, toggleMirror, captureFrame, switchCamera, retryCamera } = useCamera()

  const {
    layout, countdown, setLayout, setCountdown,
    activeFilter, activeEffects, setFilter, toggleEffect,
    capturedSlots, addPhoto, replaceSlot, resetPhotos,
    isCapturing, setIsCapturing,
    finalImageUrl, setFinalImageUrl,
    frameUrl,
  } = usePhotoboothStore()

  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [showFlash, setShowFlash] = useState(false)
  const [videoRecap, setVideoRecap] = useState(false)
  const [frameModalOpen, setFrameModalOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const abortRef = useRef(false)
  const capturedCount = capturedSlots.filter(Boolean).length

  // ---------- Auto-open frame modal when all slots filled ----------
  useEffect(() => {
    if (capturedCount === layout.slots && !finalImageUrl && !isCapturing) {
      const timer = setTimeout(() => setFrameModalOpen(true), 350)
      return () => clearTimeout(timer)
    }
  }, [capturedCount, layout.slots, finalImageUrl, isCapturing])

  // ---------- Single shot with countdown ----------
  const takeOnePhoto = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      let count = countdown
      setCountdownValue(count)
      const tick = setInterval(() => {
        count--
        if (count <= 0) {
          clearInterval(tick)
          setCountdownValue(null)
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 150)
          const dataUrl = captureFrame()
          if (dataUrl) addPhoto(dataUrl, true)
          resolve()
        } else {
          setCountdownValue(count)
        }
      }, 1000)
    })
  }, [countdown, captureFrame, addPhoto])

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
    resetPhotos()
    setFinalImageUrl(null)
    setCountdownValue(null)
  }, [resetPhotos, setFinalImageUrl, setIsCapturing])

  // ---------- Build final strip ----------
  const handleBuildStrip = useCallback(async () => {
    if (capturedSlots.some(s => s === null)) {
      messageApi.warning('Chưa đủ ảnh!')
      return
    }
    try {
      const url = await buildStripImage(capturedSlots, layout, activeEffects, frameUrl)
      setFinalImageUrl(url)
    } catch {
      messageApi.error('Tạo ảnh thất bại, thử lại nhé!')
    }
  }, [capturedSlots, layout, activeEffects, frameUrl, setFinalImageUrl, messageApi])

  // ---------- Download ----------
  const handleDownload = useCallback(() => {
    if (finalImageUrl) downloadImage(finalImageUrl, `photobooth-${Date.now()}.jpg`)
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
        currentLayout={layout.type}
        selectedFrameUrl={frameUrl}
        onSelect={(url) => {
          usePhotoboothStore.getState().setFrameUrl(url)
          setFrameModalOpen(false)
          setFinalImageUrl(null)
          // auto-build with selected frame
          setTimeout(async () => {
            try {
              const { capturedSlots: slots, layout: l, activeEffects: fx } = usePhotoboothStore.getState()
              const result = await buildStripImage(slots, l, fx, url)
              setFinalImageUrl(result)
            } catch { /* ignore */ }
          }, 0)
        }}
        onClear={() => {
          usePhotoboothStore.getState().setFrameUrl(null)
          setFinalImageUrl(null)
        }}
        onClose={() => setFrameModalOpen(false)}
      />
      <div className="min-h-screen bg-[#0d0d0d]">
        {/* Header */}
        <header className="text-center pt-6 pb-2">
          <h1 className="text-3xl font-bold tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>
            Sổ Media
          </h1>
          <p className="text-[#555] text-xs tracking-[0.25em] uppercase mt-0.5">Photobooth</p>
        </header>

        {/* Top controls */}
        <div className="max-w-5xl mx-auto px-4 py-3">
          <TopControls
            layout={layout}
            countdown={countdown}
            onLayoutChange={(l) => { setLayout(l); setFinalImageUrl(null) }}
            onCountdownChange={setCountdown}
          />
        </div>

        {/* Main content: 2-column layout */}
        <div className="max-w-5xl mx-auto px-4 pb-8 border-t border-[#1e1e1e] mt-2">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: camera + controls + filters */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
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
                frameUrl={frameUrl}
                onSwitchCamera={switchCamera}
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

            {/* Right: photo strip */}
            <div className="w-full md:w-56 lg:w-64 flex-shrink-0">
              <PhotoStrip
                layout={layout}
                slots={capturedSlots}
                finalImageUrl={finalImageUrl}
                frameUrl={frameUrl}
                onUploadSlot={handleUploadSlot}
                onRemoveSlot={handleRemoveSlot}
                onDownload={handleDownload}
                onBuildStrip={handleBuildStrip}
                onChooseFrame={() => setFrameModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
