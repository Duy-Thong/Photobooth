import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { message, Tour, type TourProps, Modal } from 'antd'
import { useCamera } from '@/hooks/useCamera'
import { useVideoRecap } from '@/hooks/useVideoRecap'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { usePhotoboothStore } from '@/stores/photoboothStore'
import { useThemeClass } from '@/stores/themeStore'
import { buildStripImage, buildStripVideo, detectFrameSlots } from '@/lib/imageProcessing'
import { LAYOUTS, FILTERS, type CapturedSlot } from '@/types/photobooth'
import CameraView from '@/components/photobooth/CameraView'
import PhotoStrip from '@/components/photobooth/PhotoStrip'
import TopControls from '@/components/photobooth/TopControls'
import CaptureControls from '@/components/photobooth/CaptureControls'
// import FilterPanel from '@/components/photobooth/FilterPanel'
import FrameModal from '@/components/photobooth/FrameModal'
import ResultModal from '@/components/photobooth/ResultModal'
import ContributeFrameModal from '@/components/photobooth/ContributeFrameModal'
import ThemeToggle from '@/components/photobooth/ThemeToggle'
import { LogoutOutlined } from '@ant-design/icons'



export default function HomePage() {
  const { videoRef, stream, isMirrored, isReady, error, toggleMirror, captureFrame, selectDevice, retryCamera, devices, activeDeviceId, soundEnabled, toggleSound } = useCamera()
  const { studioId, studioName, role, logout } = useAdminAuth()
  const navigate = useNavigate()

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
  const [isRebuildingImage, setIsRebuildingImage] = useState(false)
  const [frameModalOpen, setFrameModalOpen] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [, setTapCount] = useState(0)
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleLogoTap = useCallback(() => {
    setTapCount(c => {
      const newCount = c + 1
      if (newCount >= 5) {
        setStaffModalOpen(true)
        return 0
      }
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
      tapTimeoutRef.current = setTimeout(() => setTapCount(0), 1000)
      return newCount
    })
  }, [navigate, role, logout])

  const abortRef = useRef(false)
  const capturedCount = capturedSlots.filter(Boolean).length
  const tc = useThemeClass()

  const [tourOpen, setTourOpen] = useState(false)
  const [completionTourOpen, setCompletionTourOpen] = useState(false)

  useEffect(() => {
    const isSeen = localStorage.getItem('photobooth-tour-seen')
    if (!isSeen) {
      setTourOpen(true)
    }
  }, [])

  useEffect(() => {
    if (capturedCount === layout.slots && !isCapturing) {
      const isSeenCompletion = localStorage.getItem('photobooth-completion-seen')
      if (!isSeenCompletion) {
        setCompletionTourOpen(true)
      }
    }
  }, [capturedCount, layout.slots, isCapturing])

  const introTourSteps: TourProps['steps'] = [
    {
      title: 'Chào mừng 🎉',
      description: 'Chào mừng bạn đến với Sổ Media Photobooth! Hãy để mình hướng dẫn bạn cách tạo ra một bộ ảnh thật xịn nhé.',
      target: null,
    },
    {
      title: 'Chọn Khung',
      description: 'Đầu tiên, hãy chọn cho mình một khung ảnh thật ưng ý tại đây.',
      target: () => document.getElementById('tour-frame-button')!,
    },
    {
      title: 'Âm Thanh',
      description: 'Bật hoặc tắt âm thanh khi chụp ảnh tại đây.',
      target: () => document.getElementById('tour-sound-button')!,
    },
    {
      title: 'Giao Diện',
      description: 'Thay đổi giữa giao diện Sáng hoặc Tối tùy theo sở thích của bạn.',
      target: () => document.getElementById('tour-theme-button')!,
    },
    {
      title: 'Máy Ảnh',
      description: 'Đây là khu vực hiển thị camera của bạn. Bạn có thể lật hình hoặc đổi camera nếu muốn.',
      target: () => document.getElementById('tour-camera-view')!,
    },
    {
      title: 'Video Recap',
      description: 'Bật nút này để máy quay lại một đoạn clip ngắn mỗi khi bạn chụp ảnh, tạo thành một video kỷ niệm thú vị.',
      target: () => document.getElementById('tour-video-btn')!,
    },
    {
      title: 'Nhân Đôi (Double)',
      description: 'Dành riêng cho khung dọc: Nhấn để tự động nhân đôi dải ảnh của bạn sang hai bên.',
      target: () => document.getElementById('tour-double-btn')!,
    },
    {
      title: 'Chụp Thủ Công',
      description: 'Nếu bạn muốn tự mình bắt trọn từng khoảnh khắc, hãy nhấn nút này để chụp từng tấm một.',
      target: () => document.getElementById('tour-manual-btn')!,
    },
    {
      title: 'Chụp Tự Động (AUTO)',
      description: 'Nút quan trọng nhất! Máy sẽ tự động đếm ngược và chụp liên tục cho đến khi đủ bộ ảnh.',
      target: () => document.getElementById('tour-auto-btn')!,
    },
    {
      title: 'Chụp Lại',
      description: 'Nếu chưa ưng ý, bạn có thể nhấn nút này để xóa hết ảnh hiện tại và bắt đầu lại từ đầu.',
      target: () => document.getElementById('tour-retake-btn')!,
    },
    {
      title: 'Tải Ảnh Lên',
      description: 'Bạn có ảnh sẵn trong máy? Hãy nhấn vào đây để tải ảnh lên thay vì dùng camera nhé.',
      target: () => document.getElementById('tour-upload-btn')!,
    }
  ]

  const completionTourSteps: TourProps['steps'] = [
    {
      title: 'Xem Preview',
      description: 'Tại đây bạn có thể xem lại dải ảnh (photo strip) sơ bộ của mình trước khi hoàn thiện.',
      target: () => document.getElementById('tour-photo-strip')!,
    },
    {
      title: 'Ghép Khung',
      description: 'Sau khi đã chụp đủ ảnh, nhấn nút này để chúng mình hoàn thiện dải ảnh chính thức cho bạn nhé.',
      target: () => document.getElementById('tour-build-button')!,
    },
    {
      title: 'Lưu Ảnh',
      description: 'Ảnh đã sẵn sàng! Bạn có thể tải về máy ngay hoặc nhấn tiếp tục để lấy link chia sẻ.',
      target: () => document.getElementById('tour-download-button')!,
    },
  ]

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
    setSelectedFrame(null)
  }, [resetPhotos, setFinalImageUrl, setIsCapturing, cancelRecording, setSelectedFrame])

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
  }, [capturedSlots, layout, activeEffects, selectedFrame, setFinalImageUrl, messageApi, videoRecap, isX2])

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
      <ContributeFrameModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
      <FrameModal
        open={frameModalOpen}
        selectedFrame={selectedFrame}
        studioId={studioId ?? undefined}
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
      <Modal
        open={staffModalOpen}
        onCancel={() => setStaffModalOpen(false)}
        title={<span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">Nhân Viên</span>}
        footer={null}
        width={280}
        centered
        closable={false}
        className="dark-modal"
      >
        <div className="flex flex-col gap-2 py-2">
          <button
            onClick={() => { setStaffModalOpen(false); navigate(role === 'superadmin' ? '/admin' : '/studio/dashboard') }}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-semibold tracking-wide transition-all ${tc(
              'bg-[#111] border-[#222] text-[#888] hover:border-[#444] hover:text-white',
              'bg-white border-[#e0e0e0] text-[#666] hover:border-[#999] hover:text-black'
            )}`}
          >
            Quay về Dashboard
            <span className="opacity-40">→</span>
          </button>
          
          <button
            onClick={() => {
              setStaffModalOpen(false)
              Modal.confirm({
                title: 'Đăng xuất?',
                content: 'Bạn sẽ được đăng xuất khỏi thiết bị này.',
                okText: 'Đăng xuất',
                cancelText: 'Hủy',
                centered: true,
                okButtonProps: { danger: true },
                onOk: () => { logout?.(); navigate('/login') },
              })
            }}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-semibold tracking-wide transition-all ${tc(
              'border-red-500/10 text-red-500/60 hover:bg-red-500/5 hover:text-red-500',
              'border-red-100 text-red-400 hover:bg-red-50/50 hover:text-red-600'
            )}`}
          >
            Đăng xuất
            <LogoutOutlined className="text-[14px]" />
          </button>
          
          <button
            onClick={() => setStaffModalOpen(false)}
            className={`mt-2 py-2 text-[10px] uppercase font-bold tracking-widest text-center opacity-30 hover:opacity-100 transition-opacity ${tc('text-white', 'text-black')}`}
          >
            Quay lại
          </button>
        </div>
      </Modal>

      <ResultModal
        open={resultModalOpen}
        imageBlobUrl={finalImageUrl}
        recapClips={capturedSlots.filter((s): s is CapturedSlot => s !== null).map(s => s.dataUrl)}
        recapMimeType={recapMimeType}
        recapStripUrl={recapStripUrl}
        buildingStrip={buildingStrip}
        isX2={isX2}
        onToggleX2={() => setIsX2(!isX2)}
        isRebuildingImage={isRebuildingImage}
        studioId={studioId || undefined}
        frameId={selectedFrame?.id?.toString() || selectedFrame?.firestoreId}
        frameName={selectedFrame?.name}
        onClose={() => {
          setResultModalOpen(false)
          resetPhotos()
        }}
        onRetake={() => {
          setResultModalOpen(false)
          resetPhotos()
        }}
        onChangeFrame={() => {
          setResultModalOpen(false)
          setFrameModalOpen(true)
        }}
      />
      <div className={`min-h-dvh flex flex-col ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
        {/* Header */}
        <header className={`pt-5 pb-4 border-b relative ${tc('border-[#141414]', 'border-[#e0e0e0]')}`}>
          <div className="text-center cursor-pointer select-none" onClick={handleLogoTap}>
            <h1 className={`text-2xl font-bold ${tc('text-white', 'text-black')}`} style={{ letterSpacing: '-0.03em' }}>
              Sổ Media
            </h1>
            <p className={`text-[9px] tracking-[0.35em] uppercase mt-0.5 font-medium ${tc('text-white', 'text-black')}`}>Photobooth</p>
            {studioName && (
              <p className={`text-[9px] tracking-widest mt-0.5 ${tc('text-[#555]', 'text-[#aaa]')}`}>{studioName}</p>
            )}
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <ThemeToggle />
          </div>
        </header>

        {/* Top controls bar */}
        <div className={`border-b px-4 py-2.5 ${tc('border-[#141414]', 'border-[#e0e0e0]')}`}>
          <div className="max-w-5xl mx-auto">
            <TopControls
              countdown={countdown}
              videoRecap={videoRecap}
              selectedFrame={selectedFrame}
              soundEnabled={soundEnabled}
              onCountdownChange={setCountdown}
              onChooseFrame={() => setFrameModalOpen(true)}
              onClearFrame={() => {
                setSelectedFrame(null)
                setFinalImageUrl(null)
              }}
              onContributeFrame={() => setContributeOpen(true)}
              onToggleSound={toggleSound}
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
                countdown={countdown}
                capturedCount={capturedCount}
                totalSlots={layout.slots}
                videoRecap={videoRecap}
                onManualCapture={handleManualCapture}
                onAutoCapture={handleAutoCapture}
                onRetake={handleRetake}
                onUploadAll={handleUploadAll}
                onToggleVideoRecap={setVideoRecap}
                isX2={isX2}
                onToggleX2={setIsX2}
                layout={layout}
              />
              {/* <FilterPanel
                activeFilter={activeFilter}
                activeEffects={activeEffects}
                onFilterChange={setFilter}
                onEffectToggle={toggleEffect}
              /> */}
            </div>

            {/* Right: photo strip — width depends on layout cols, self-start so it doesn't grow to camera height */}
            <div className={`shrink-0 w-full md:self-start ${layout.cols === 2 ? 'md:w-72 lg:w-80' : 'md:w-48 lg:w-56'}`}>
              <PhotoStrip
                layout={layout}
                slots={capturedSlots}
                finalImageUrl={finalImageUrl}
                selectedFrame={selectedFrame}
                activeEffects={activeEffects}
                stream={stream}
                isMirrored={isMirrored}
                onUploadSlot={handleUploadSlot}
                onRemoveSlot={handleRemoveSlot}
                onDownload={handleDownload}
                onBuildStrip={handleBuildStrip}
              />
            </div>
          </div>
        </div>
      </div>
      <Tour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false)
          localStorage.setItem('photobooth-tour-seen', 'true')
        }}
        steps={introTourSteps}
        getPopupContainer={() => document.body}
      />
      <Tour
        open={completionTourOpen}
        onClose={() => {
          setCompletionTourOpen(false)
          localStorage.setItem('photobooth-completion-seen', 'true')
        }}
        steps={completionTourSteps}
        getPopupContainer={() => document.body}
      />
    </>
  )
}
