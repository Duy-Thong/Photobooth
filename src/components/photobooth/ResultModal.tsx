import { useEffect, useState, useRef } from 'react'
import { Modal, QRCode, Spin, Button, message } from 'antd'
import {
  DownloadOutlined,
  ReloadOutlined,
  PictureOutlined,
  LoadingOutlined,
  CopyOutlined,
  CheckOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { uploadSession } from '@/lib/uploadService'
import { downloadImage, downloadMedia, isMobileDevice } from '@/lib/imageProcessing'
import { useThemeClass } from '@/stores/themeStore'

type Phase = 'uploading' | 'done' | 'error'

interface ResultModalProps {
  open: boolean
  /** blob URL of the final composited strip (clean, without QR) */
  imageBlobUrl: string | null
  /** MIME type shared across clips, e.g. 'video/mp4' or 'video/webm' */
  recapMimeType?: string | null
  /** Combined strip video with frame overlay */
  recapStripUrl?: string | null
  /** True while buildStripVideo is still running */
  buildingStrip?: boolean
  onClose: () => void
  onRetake: () => void
  onChangeFrame: () => void
}

export default function ResultModal({
  open,
  imageBlobUrl,
  recapMimeType,
  recapStripUrl,
  buildingStrip,
  onClose,
  onRetake,
  onChangeFrame,
}: ResultModalProps) {
  const tc = useThemeClass()
  const recapExt = recapMimeType?.startsWith('video/mp4') ? 'mp4' : 'webm'

  const [phase, setPhase] = useState<Phase>('uploading')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [uploadKey, setUploadKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [mediaTab, setMediaTab] = useState<'photo' | 'video'>('photo')

  const lastOpenedUrlRef = useRef<string | null>(null)
  const lastUploadKeyRef = useRef(0)
  const lastUploadedUrlRef = useRef<string | null>(null)
  const lastSessionIdRef = useRef<string | null>(null)
  const isUploadingRef = useRef(false)

  const sessionUrl = sessionId ? `${window.location.origin}/session/${sessionId}` : ''

  const handleCopyUrl = () => {
    if (!sessionUrl) return
    navigator.clipboard.writeText(sessionUrl).then(() => {
      setCopied(true)
      message.success('Đã copy link!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShare = async () => {
    if (navigator.share && sessionUrl) {
      try {
        await navigator.share({
          title: 'Sổ Media Photobooth',
          text: 'Xem bộ ảnh photobooth siêu xinh của mình nè! ✨',
          url: sessionUrl,
        })
      } catch {
        // User cancelled or share not supported
      }
    } else {
      handleCopyUrl()
    }
  }

  useEffect(() => {
    if (!open || !imageBlobUrl) return

    if (imageBlobUrl === lastOpenedUrlRef.current) {
      if (phase === 'done' && sessionId) return
      if (phase === 'uploading') return
    }

    lastOpenedUrlRef.current = imageBlobUrl

    if (imageBlobUrl === lastUploadedUrlRef.current && lastSessionIdRef.current) {
      setSessionId(lastSessionIdRef.current)
      setPhase('done')
      return
    }

    setPhase('uploading')
    setSessionId(null)
    setErrorMsg(null)
    setMediaTab('photo')
    setUploadKey(k => k + 1)
  }, [open, imageBlobUrl])

  useEffect(() => {
    if (uploadKey === 0 || !imageBlobUrl) return
    if (buildingStrip) return
    if (isUploadingRef.current) return
    if (lastUploadKeyRef.current === uploadKey) return

    if (lastUploadedUrlRef.current === imageBlobUrl && lastSessionIdRef.current) {
      if (sessionId !== lastSessionIdRef.current) setSessionId(lastSessionIdRef.current)
      setPhase('done')
      return
    }

    lastUploadKeyRef.current = uploadKey
    isUploadingRef.current = true
    lastUploadedUrlRef.current = imageBlobUrl

    let cancelled = false

    const timeout = setTimeout(() => {
      if (!cancelled && phase === 'uploading') {
        setPhase('done')
        message.info('Mạng hơi chậm, bạn có thể tải ảnh trực tiếp về trước nhé!')
      }
    }, 15000)

    async function run() {
      try {
        const result = await uploadSession(
          imageBlobUrl!,
          recapStripUrl ?? null,
          recapMimeType ?? undefined,
        )
        if (cancelled) return
        clearTimeout(timeout)
        setSessionId(result.sessionId)
        lastSessionIdRef.current = result.sessionId
        lastUploadedUrlRef.current = imageBlobUrl
        setPhase('done')
      } catch (err: unknown) {
        if (cancelled) return
        clearTimeout(timeout)
        console.warn('Session upload failed, fallback to done state:', err)
        setPhase('done')
      } finally {
        isUploadingRef.current = false
      }
    }

    run()

    return () => {
      cancelled = true
      clearTimeout(timeout)
      isUploadingRef.current = false
    }
  }, [uploadKey, imageBlobUrl, recapStripUrl, recapMimeType, buildingStrip])

  const handleDownload = async () => {
    if (!imageBlobUrl || downloading) return
    setDownloading(true)
    try {
      await downloadImage(imageBlobUrl, `somedia-strip-${Date.now()}.jpg`)
    } finally {
      setDownloading(false)
    }
  }

  const handleStartUpload = () => {
    setPhase('uploading')
    setErrorMsg(null)
    setUploadKey(k => k + 1)
  }

  const btnSecondaryClass = tc(
    'bg-[#161616] text-[#e0e0e0] border-[#2a2a2a] hover:bg-[#222] hover:border-[#444] hover:text-white',
    'bg-[#f5f5f5] text-[#333] border-[#d8d8d8] hover:bg-[#eaeaea] hover:border-[#bbb] hover:text-black'
  )

  const smallBtnClass = tc(
    'bg-[#222] text-[#ccc] hover:bg-[#333] hover:text-white',
    'bg-[#eaeaea] text-[#444] hover:bg-[#ddd] hover:text-black'
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className={`font-bold text-base sm:text-lg tracking-tight ${tc('text-white', 'text-black')}`}>
            {phase === 'uploading' && 'Đang chuẩn bị ảnh & mã QR...'}
            {phase === 'done' && 'Ảnh của bạn đã hoàn thành ✨'}
            {phase === 'error' && 'Có lỗi xảy ra'}
          </span>
        </div>
      }
      footer={null}
      width="min(1180px, 94vw)"
      centered
      styles={{
        body: {
          background: tc('#111111', '#ffffff') === '#111111' ? '#111111' : '#ffffff',
          padding: '20px 24px 28px',
          maxHeight: '90vh',
          overflowY: 'auto',
        },
        header: {
          background: tc('#111111', '#ffffff') === '#111111' ? '#111111' : '#ffffff',
          borderBottom: `1px solid ${tc('#1f1f1f', '#f0f0f0') === '#1f1f1f' ? '#1f1f1f' : '#f0f0f0'}`,
          paddingBottom: '14px',
        },
      }}
    >
      {/* ── LOADING ─────────────────────────────────────────────────────────── */}
      {phase === 'uploading' && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Spin size="large" />
          <div>
            <p className={`text-base font-medium ${tc('text-[#e5e5e5]', 'text-[#333]')}`}>Đang tải ảnh &amp; tạo liên kết chia sẻ...</p>
            <p className={`text-xs mt-1.5 ${tc('text-[#666]', 'text-[#999]')}`}>Vui lòng đợi trong giây lát</p>
          </div>
          {imageBlobUrl && (
            <Button
              onClick={handleDownload}
              icon={downloading ? <LoadingOutlined /> : <DownloadOutlined />}
              disabled={downloading}
              className="mt-3"
            >
              Tải ảnh về máy ngay
            </Button>
          )}
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
          <div className="flex gap-2 mt-2">
            <Button onClick={onClose}>Đóng</Button>
            <Button type="primary" onClick={handleStartUpload}>
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {/* ── DONE ─────────────────────────────────────────────────────────────── */}
      {phase === 'done' && imageBlobUrl && (
        <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start mt-3">
          {/* Left — Large Media Preview (Photo / Video Recap Tabs) */}
          <div className="w-full md:w-[380px] lg:w-[450px] shrink-0 flex flex-col gap-3">
            {/* View Mode Toggle Pill (if video recap is present or building) */}
            {(recapStripUrl || buildingStrip) && (
              <div className={`p-1 rounded-xl border flex items-center justify-center gap-1.5 ${tc('bg-[#080808] border-[#222]', 'bg-[#f0f0f0] border-[#e0e0e0]')}`}>
                <button
                  onClick={() => setMediaTab('photo')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mediaTab === 'photo'
                      ? tc('bg-[#222] text-white shadow-sm', 'bg-white text-black shadow-sm')
                      : tc('text-[#777] hover:text-[#bbb]', 'text-[#888] hover:text-[#444]')
                  }`}
                >
                  <PictureOutlined /> Ảnh chụp
                </button>
                <button
                  onClick={() => setMediaTab('video')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mediaTab === 'video'
                      ? tc('bg-[#222] text-white shadow-sm', 'bg-white text-black shadow-sm')
                      : tc('text-[#777] hover:text-[#bbb]', 'text-[#888] hover:text-[#444]')
                  }`}
                >
                  {buildingStrip && !recapStripUrl ? <LoadingOutlined /> : <span>🎞️ Video Recap</span>}
                </button>
              </div>
            )}

            {/* Media Box */}
            <div className={`w-full rounded-2xl border p-2 flex items-center justify-center shadow-xl ${tc('bg-[#080808] border-[#222]', 'bg-[#fafafa] border-[#e5e5e5]')}`}>
              {mediaTab === 'photo' || (!recapStripUrl && !buildingStrip) ? (
                <img
                  src={imageBlobUrl}
                  alt="Final photo strip"
                  className="w-full max-h-[45vh] md:max-h-[65vh] object-contain rounded-xl shadow-md"
                />
              ) : recapStripUrl ? (
                <video
                  src={recapStripUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full max-h-[45vh] md:max-h-[65vh] object-contain rounded-xl shadow-md"
                />
              ) : (
                <div className={`flex flex-col items-center justify-center gap-3 py-24 text-xs font-medium ${tc('text-[#777]', 'text-[#888]')}`}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  <span>Đang kết xuất video strip recap...</span>
                </div>
              )}
            </div>

            {isMobileDevice() && (
              <p className={`text-xs text-center font-medium opacity-60 ${tc('text-gray-400', 'text-gray-500')}`}>
                💡 Nhấn giữ ảnh/video để lưu trực tiếp vào thư viện
              </p>
            )}
          </div>

          {/* Right — Actions & QR Code */}
          <div className="flex-1 w-full flex flex-col gap-5 min-w-0">
            {/* Primary Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`w-full h-12 sm:h-13 rounded-2xl font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${tc(
                  'bg-white text-black hover:bg-[#ececec] shadow-[0_0_20px_rgba(255,255,255,0.15)]',
                  'bg-black text-white hover:bg-[#222] shadow-[0_0_20px_rgba(0,0,0,0.15)]'
                )}`}
              >
                {downloading ? <LoadingOutlined /> : <DownloadOutlined style={{ fontSize: 18 }} />}
                Tải ảnh về máy
              </button>

              {recapStripUrl && (
                <button
                  disabled={downloading}
                  onClick={async () => {
                    if (downloading) return
                    setDownloading(true)
                    try {
                      await downloadMedia(recapStripUrl, `somedia-strip-${Date.now()}.${recapExt}`)
                    } finally {
                      setDownloading(false)
                    }
                  }}
                  className={`w-full h-11 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-md disabled:opacity-50 ${btnSecondaryClass}`}
                >
                  <DownloadOutlined /> Tải Video Recap (.{recapExt})
                </button>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onChangeFrame}
                  className={`h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${btnSecondaryClass}`}
                >
                  <PictureOutlined /> Đổi khung
                </button>
                <button
                  onClick={onRetake}
                  className={`h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${btnSecondaryClass}`}
                >
                  <ReloadOutlined /> Chụp lại
                </button>
              </div>
            </div>

            {/* QR Code & Share Card */}
            <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col items-center gap-3.5 shadow-lg ${tc('bg-[#0a0a0a]', 'bg-[#f7f7f7]')}`}>
              <div className="flex items-center gap-1.5 text-center">
                <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${tc('text-[#aaa]', 'text-[#555]')}`}>
                  📱 Quét mã QR để xem &amp; tải trên điện thoại
                </span>
              </div>

              {sessionId ? (
                <>
                  <div className="p-3 bg-white rounded-2xl shadow-md inline-flex items-center justify-center border border-gray-200">
                    <QRCode
                      value={sessionUrl}
                      size={155}
                      bordered={false}
                      errorLevel="H"
                      color="#000000"
                      bgColor="#ffffff"
                      icon="/clublogo.png"
                      iconSize={36}
                    />
                  </div>

                  {/* URL Row */}
                  <div className={`w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl p-2 sm:pl-3.5 border ${tc('bg-[#141414] border-[#222]', 'bg-white border-[#e0e0e0]')}`}>
                    <span className={`flex-1 text-xs truncate select-all font-mono ${tc('text-[#aaa]', 'text-[#555]')}`}>
                      {sessionUrl}
                    </span>
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <a
                        href={sessionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${smallBtnClass}`}
                        title="Mở tab mới"
                      >
                        Mở ↗
                      </a>
                      <button
                        onClick={handleCopyUrl}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${smallBtnClass}`}
                        title="Copy link"
                      >
                        {copied ? <CheckOutlined className="text-green-400" /> : <CopyOutlined />}
                        Copy
                      </button>
                      <button
                        onClick={handleShare}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${smallBtnClass}`}
                        title="Chia sẻ"
                      >
                        <ShareAltOutlined />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 flex flex-col items-center gap-2.5">
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  <span className={`text-xs font-medium ${tc('text-[#777]', 'text-[#888]')}`}>Đang khởi tạo mã QR...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
