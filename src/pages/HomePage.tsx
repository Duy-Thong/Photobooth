import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import { useCamera } from '@/hooks/useCamera'
import { useVideoRecap } from '@/hooks/useVideoRecap'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { useThemeClass } from '@/stores/themeStore'
import { buildStripImage, buildStripVideo, detectFrameSlots } from '@/lib/imageProcessing'
import type { FrameItem } from '@/lib/frameService'
import { LAYOUTS, FILTERS } from '@/types/photobooth'
import PhotoboothHeader from '@/components/photobooth/PhotoboothHeader'
import DesktopStudio from '@/components/photobooth/DesktopStudio'
import MobileStudio from '@/components/photobooth/MobileStudio'
import FrameModal from '@/components/photobooth/FrameModal'
import ResultModal from '@/components/photobooth/ResultModal'
import ContributeFrameModal from '@/components/photobooth/ContributeFrameModal'
import PrivacyNoticeModal from '@/components/photobooth/PrivacyNoticeModal'

export default function HomePage() {
  const {
    videoRef,
    stream,
    isMirrored,
    isReady,
    error,
    toggleMirror,
    captureFrame,
    selectDevice,
    retryCamera,
    devices,
    activeDeviceId,
    soundEnabled,
    toggleSound,
  } = useCamera()

  const {
    layout,
    countdown,
    setCountdown,
    activeFilter,
    activeEffects,
    capturedSlots,
    addPhoto,
    replaceSlot,
    resetPhotos,
    isCapturing,
    setIsCapturing,
    finalImageUrl,
    setFinalImageUrl,
    selectedFrame,
    setSelectedFrame,
    isX2,
    setIsX2,
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

  // Helper to clear & revoke all video recap clips
  const clearRecapClips = useCallback(() => {
    setRecapClips(prev => {
      prev.forEach(url => {
        if (url) URL.revokeObjectURL(url)
      })
      return []
    })
    setRecapStripUrl(null)
    setBuildingStrip(false)
  }, [])

  const handleToggleVideoRecap = useCallback(
    (enabled: boolean) => {
      setVideoRecap(enabled)
      if (!enabled) {
        clearRecapClips()
      }
    },
    [clearRecapClips]
  )

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
      .catch(() => {})
      .finally(() => setBuildingStrip(false))
    // Re-run only when finalImageUrl changes
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
  const takeOnePhoto = useCallback((): Promise<void> => {
    return new Promise(resolve => {
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
  }, [
    countdown,
    captureFrame,
    addPhoto,
    videoRecap,
    startRecording,
    stopRecording,
    getVideoMimeType,
    activeFilter,
    layout.slots,
  ])

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
  const handleUploadSlot = useCallback(
    (index: number, dataUrl: string) => {
      replaceSlot(index, dataUrl)
      setFinalImageUrl(null)
      setRecapClips(prev => {
        const next = [...prev]
        if (next[index]) {
          URL.revokeObjectURL(next[index]!)
          next[index] = null
        }
        return next
      })
      setRecapStripUrl(null)
    },
    [replaceSlot, setFinalImageUrl]
  )

  const handleRemoveSlot = useCallback((index: number) => {
    usePhotoboothStore.setState(s => {
      const next = [...s.capturedSlots]
      next[index] = null
      return { capturedSlots: next, finalImageUrl: null }
    })
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

  const handleUploadAll = useCallback(
    (dataUrl: string) => {
      if (!selectedFrame) {
        messageApi.warning('Vui lòng chọn khung ảnh trước khi tải ảnh!')
        setFrameModalOpen(true)
        return
      }
      addPhoto(dataUrl, false)
      setFinalImageUrl(null)
      clearRecapClips()
    },
    [selectedFrame, addPhoto, setFinalImageUrl, clearRecapClips, messageApi]
  )

  const handleFrameSelect = useCallback(
    async (url: string, frameItem: FrameItem) => {
      let detectedSlots = frameItem.slots_data ? frameItem.slots_data.length : 0
      if (detectedSlots === 0) {
        try {
          detectedSlots = (await detectFrameSlots(url)).length
        } catch {
          /* noop */
        }
      }

      const store = usePhotoboothStore.getState()
      let targetLayout = store.layout
      if (detectedSlots > 0) {
        const match =
          LAYOUTS.find(
            l =>
              l.slots === detectedSlots &&
              (detectedSlots === 4
                ? frameItem.frame === 'grid'
                  ? l.cols === 2
                  : l.cols === 1
                : detectedSlots === 6
                  ? l.cols === 2
                  : true)
          ) ?? LAYOUTS.find(l => l.slots === detectedSlots)
        if (match && match.type !== store.layout.type) {
          if (match.slots === store.layout.slots) {
            store.setLayoutKeepPhotos(match)
          } else {
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

      const refreshed = usePhotoboothStore.getState()
      if (refreshed.capturedSlots.every(s => s !== null)) {
        setTimeout(async () => {
          try {
            const { capturedSlots: cs, activeEffects: fx, isX2: currentX2 } = usePhotoboothStore.getState()
            if (videoRecap) setBuildingStrip(true)
            const result = await buildStripImage(cs, targetLayout, fx, url, frameItem.slots_data, currentX2)
            setFinalImageUrl(result)
            setResultModalOpen(true)
          } catch {
            /* ignore */
          }
        }, 0)
      }
    },
    [clearRecapClips, messageApi, setSelectedFrame, setFinalImageUrl, videoRecap]
  )

  const handleFrameClear = useCallback(() => {
    setSelectedFrame(null)
    setFinalImageUrl(null)
    clearRecapClips()
  }, [setSelectedFrame, setFinalImageUrl, clearRecapClips])

  return (
    <>
      {contextHolder}
      <ContributeFrameModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
      <FrameModal
        open={frameModalOpen}
        currentLayout={layout}
        selectedFrame={selectedFrame}
        onSelect={handleFrameSelect}
        onClear={handleFrameClear}
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
      <PrivacyNoticeModal open={privacyModalOpen} onClose={handleClosePrivacyModal} />

      <div className={`h-dvh max-h-dvh overflow-hidden flex flex-col ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
        {/* Header - slim & centered */}
        <PhotoboothHeader />

        {/* Main Studio Area */}
        <main className="flex-1 h-full w-full max-w-[1640px] mx-auto px-2 sm:px-4 lg:px-6 py-1 md:py-2 overflow-hidden flex flex-col justify-between min-h-0">
          {/* Desktop Studio View */}
          <DesktopStudio
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            isMirrored={isMirrored}
            isReady={isReady}
            error={error}
            activeFilter={activeFilter}
            capturedCount={capturedCount}
            countdownValue={countdownValue}
            showFlash={showFlash}
            devices={devices}
            activeDeviceId={activeDeviceId}
            onSelectDevice={selectDevice}
            onToggleMirror={toggleMirror}
            onRetry={retryCamera}
            isCapturing={isCapturing}
            countdown={countdown}
            videoRecap={videoRecap}
            selectedFrame={selectedFrame}
            soundEnabled={soundEnabled}
            onManualCapture={handleManualCapture}
            onAutoCapture={handleAutoCapture}
            onRetake={handleRetake}
            onUploadAll={handleUploadAll}
            onToggleVideoRecap={handleToggleVideoRecap}
            onChooseFrame={() => setFrameModalOpen(true)}
            onClearFrame={handleFrameClear}
            onContributeFrame={() => setContributeOpen(true)}
            onCountdownChange={setCountdown}
            onToggleSound={toggleSound}
            isX2={isX2}
            onToggleX2={setIsX2}
            layout={layout}
            isWideStrip={isWideStrip}
            capturedSlots={capturedSlots}
            finalImageUrl={finalImageUrl}
            activeEffects={activeEffects}
            stream={stream}
            onUploadSlot={handleUploadSlot}
            onRemoveSlot={handleRemoveSlot}
            onDownload={handleDownload}
            onBuildStrip={handleBuildStrip}
          />

          {/* Mobile Studio View */}
          <MobileStudio
            isMobile={isMobile}
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            stream={stream}
            isMirrored={isMirrored}
            isReady={isReady}
            devices={devices}
            activeDeviceId={activeDeviceId}
            onSelectDevice={selectDevice}
            onToggleMirror={toggleMirror}
            layout={layout}
            capturedSlots={capturedSlots}
            capturedCount={capturedCount}
            finalImageUrl={finalImageUrl}
            selectedFrame={selectedFrame}
            activeEffects={activeEffects}
            isCapturing={isCapturing}
            countdownValue={countdownValue}
            showFlash={showFlash}
            countdown={countdown}
            videoRecap={videoRecap}
            soundEnabled={soundEnabled}
            isX2={isX2}
            buildingStrip={buildingStrip}
            onManualCapture={handleManualCapture}
            onAutoCapture={handleAutoCapture}
            onRetake={handleRetake}
            onUploadAll={handleUploadAll}
            onToggleVideoRecap={handleToggleVideoRecap}
            onChooseFrame={() => setFrameModalOpen(true)}
            onCountdownChange={setCountdown}
            onToggleSound={toggleSound}
            onToggleX2={setIsX2}
            onUploadSlot={handleUploadSlot}
            onRemoveSlot={handleRemoveSlot}
            onDownload={handleDownload}
            onBuildStrip={handleBuildStrip}
          />
        </main>
      </div>
    </>
  )
}
