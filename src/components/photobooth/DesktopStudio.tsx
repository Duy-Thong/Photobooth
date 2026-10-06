import { useRef, useState, useEffect } from 'react'
import type { CameraDevice } from '@/hooks/useCamera'
import type { CapturedSlot, EffectType, FilterType, LayoutConfig } from '@/types/photobooth'
import type { FrameItem } from '@/lib/frameService'
import CameraView from '@/components/photobooth/CameraView'
import CaptureControls from '@/components/photobooth/CaptureControls'
import PhotoStrip from '@/components/photobooth/PhotoStrip'

export interface DesktopStudioProps {
  // Camera
  videoRef: React.RefObject<HTMLVideoElement>
  isMirrored: boolean
  isReady: boolean
  error: string | null
  activeFilter: FilterType
  capturedCount: number
  countdownValue: number | null
  showFlash: boolean
  devices: CameraDevice[]
  activeDeviceId: string | null
  onSelectDevice: (deviceId: string) => void
  onToggleMirror: () => void
  onRetry: () => void

  // Controls
  isCapturing: boolean
  countdown: number
  videoRecap: boolean
  selectedFrame: FrameItem | null
  soundEnabled: boolean
  onManualCapture: () => void
  onAutoCapture: () => void
  onRetake: () => void
  onUploadAll: (dataUrl: string) => void
  onToggleVideoRecap: (v: boolean) => void
  onChooseFrame: () => void
  onClearFrame: () => void
  onContributeFrame: () => void
  onCountdownChange: (n: number) => void
  onToggleSound: () => void
  isX2: boolean
  onToggleX2: (v: boolean) => void
  layout: LayoutConfig

  // Photo Strip
  isWideStrip: boolean
  capturedSlots: (CapturedSlot | null)[]
  finalImageUrl: string | null
  activeEffects: EffectType[]
  stream: MediaStream | null
  onUploadSlot: (index: number, dataUrl: string) => void
  onRemoveSlot: (index: number) => void
  onDownload: () => void
  onBuildStrip: () => void
}

export default function DesktopStudio({
  videoRef,
  isMirrored,
  isReady,
  error,
  activeFilter,
  capturedCount,
  countdownValue,
  showFlash,
  devices,
  activeDeviceId,
  onSelectDevice,
  onToggleMirror,
  onRetry,
  isCapturing,
  countdown,
  videoRecap,
  selectedFrame,
  soundEnabled,
  onManualCapture,
  onAutoCapture,
  onRetake,
  onUploadAll,
  onToggleVideoRecap,
  onChooseFrame,
  onClearFrame,
  onContributeFrame,
  onCountdownChange,
  onToggleSound,
  isX2,
  onToggleX2,
  layout,
  isWideStrip,
  capturedSlots,
  finalImageUrl,
  activeEffects,
  stream,
  onUploadSlot,
  onRemoveSlot,
  onDownload,
  onBuildStrip,
}: DesktopStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stripColRef = useRef<HTMLDivElement>(null)
  const [desktopDeckWidth, setDesktopDeckWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
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

  return (
    <div
      ref={containerRef}
      className="hidden md:flex flex-row gap-3 sm:gap-5 h-full w-full items-center justify-center max-w-full min-w-0 mx-auto"
    >
      {/* Left: camera + unified capture controls (1 cohesive deck) */}
      <div
        style={{ width: desktopDeckWidth ? `${desktopDeckWidth}px` : undefined }}
        className="flex flex-col gap-2 shrink-0 items-center justify-center max-w-full transition-all duration-150"
      >
        <div className="w-full shrink-0">
          <CameraView
            videoRef={videoRef}
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
            onSelectDevice={onSelectDevice}
            onToggleMirror={onToggleMirror}
            onRetry={onRetry}
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
            onManualCapture={onManualCapture}
            onAutoCapture={onAutoCapture}
            onRetake={onRetake}
            onUploadAll={onUploadAll}
            onToggleVideoRecap={onToggleVideoRecap}
            onChooseFrame={onChooseFrame}
            onClearFrame={onClearFrame}
            onContributeFrame={onContributeFrame}
            onCountdownChange={onCountdownChange}
            onToggleSound={onToggleSound}
            isX2={isX2}
            onToggleX2={onToggleX2}
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
          onUploadSlot={onUploadSlot}
          onRemoveSlot={onRemoveSlot}
          onDownload={onDownload}
          onBuildStrip={onBuildStrip}
        />
      </div>
    </div>
  )
}
