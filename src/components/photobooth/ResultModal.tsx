import { useEffect, useState, useRef } from 'react'
import { Modal, QRCode, Spin, message } from 'antd'
import {
  DownloadOutlined,
  ReloadOutlined,
  PictureOutlined,
  LoadingOutlined,
  CopyOutlined,
  CheckOutlined,
  ShareAltOutlined,
  QrcodeOutlined,
} from '@ant-design/icons'
import { uploadSession } from '@/lib/uploadService'
import { downloadImage, downloadMedia, isMobileDevice } from '@/lib/imageProcessing'
import { useThemeClass } from '@/stores/themeStore'

type QrState = 'idle' | 'uploading' | 'ready' | 'error'

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

  const [qrState, setQrState] = useState<QrState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qrErrorMsg, setQrErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [mediaTab, setMediaTab] = useState<'photo' | 'video'>('photo')

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

  // Reset or preserve state on modal open
  useEffect(() => {
    if (!open || !imageBlobUrl) return
    setMediaTab('photo')

    if (imageBlobUrl === lastUploadedUrlRef.current && lastSessionIdRef.current) {
      setSessionId(lastSessionIdRef.current)
      setQrState('ready')
    } else {
      setQrState('idle')
      setSessionId(null)
      setQrErrorMsg(null)
    }
  }, [open, imageBlobUrl])

  // Explicit action when user clicks "⚡ Tạo Mã QR & Link Chia Sẻ"
  const handleCreateQR = async () => {
    if (!imageBlobUrl || isUploadingRef.current) return
    if (buildingStrip) {
      message.info('Đang hoàn tất kết xuất video recap, vui lòng đợi giây lát...')
      return
    }

    setQrState('uploading')
    setQrErrorMsg(null)
    isUploadingRef.current = true

    try {
      const result = await uploadSession(
        imageBlobUrl,
        recapStripUrl ?? null,
        recapMimeType ?? undefined,
      )
      setSessionId(result.sessionId)
      lastSessionIdRef.current = result.sessionId
      lastUploadedUrlRef.current = imageBlobUrl
      setQrState('ready')
      message.success('Đã tạo mã QR & liên kết chia sẻ!')
    } catch (err: unknown) {
      console.warn('Session upload failed:', err)
      setQrErrorMsg('Không thể kết nối máy chủ để tạo mã QR. Vui lòng thử lại!')
      setQrState('error')
    } finally {
      isUploadingRef.current = false
    }
  }

  const handleDownload = async () => {
    if (!imageBlobUrl || downloading) return
    setDownloading(true)
    try {
      await downloadImage(imageBlobUrl, `somedia-strip-${Date.now()}.jpg`)
    } finally {
      setDownloading(false)
    }
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
            Bộ ảnh photobooth của bạn ✨
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
      {imageBlobUrl && (
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
                Tải ảnh về máy (Miễn phí)
              </button>

              {/* Local Storage Privacy Badge */}
              <div className={`p-2 rounded-xl text-center border flex items-center justify-center gap-1.5 ${tc('bg-emerald-500/10 border-emerald-500/20 text-emerald-400', 'bg-emerald-50 border-emerald-200 text-emerald-700')}`}>
                <span className="text-xs">🛡️</span>
                <span className="text-[11px] font-semibold">Quyền riêng tư: Mặc định ảnh KHÔNG tự động lưu trên hệ thống.</span>
              </div>

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

            {/* QR Code & Share Card (On-Demand + Private Cloud Notice) */}
            <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col items-center gap-3.5 shadow-lg ${tc('bg-[#0a0a0a] border-[#1e1e1e]', 'bg-[#f7f7f7] border-[#e0e0e0]')}`}>
              {qrState === 'idle' && (
                <div className="w-full flex flex-col items-center gap-3 text-center py-1">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${tc('text-white', 'text-black')}`}>
                      📱 Quét mã QR để xem &amp; tải trên điện thoại
                    </span>
                    <span className={`text-[11px] ${tc('text-[#888]', 'text-[#777]')}`}>
                      Tạo mã QR nếu bạn muốn chuyển ảnh sang điện thoại hoặc gửi bạn bè.
                    </span>
                  </div>

                  {/* Private Cloud Notice Box */}
                  <div className={`w-full p-2.5 rounded-xl text-left border flex items-start gap-2 ${tc('bg-blue-500/10 border-blue-500/25 text-blue-300', 'bg-blue-50 border-blue-200 text-blue-800')}`}>
                    <span className="text-sm shrink-0">🔒</span>
                    <p className="text-[11px] leading-relaxed">
                      <strong className="font-bold">Lưu ý riêng tư:</strong> Khi bấm tạo QR, ảnh sẽ được tải lên Cloud lưu trữ <strong className="underline">riêng tư</strong> (chỉ ai có mã QR/link mới xem được, <strong>KHÔNG công khai</strong> lên bảng tin hay bất kỳ đâu).
                    </p>
                  </div>

                  <button
                    onClick={handleCreateQR}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-lg active:scale-[0.98] ${tc(
                      'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/30 shadow-blue-500/20',
                      'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/30 shadow-blue-500/20'
                    )}`}
                  >
                    <QrcodeOutlined style={{ fontSize: 16 }} />
                    Tạo Mã QR &amp; Link Chia Sẻ
                  </button>
                </div>
              )}

              {qrState === 'uploading' && (
                <div className="py-6 flex flex-col items-center gap-2.5 text-center">
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  <span className={`text-xs font-medium ${tc('text-[#aaa]', 'text-[#666]')}`}>
                    Đang tải ảnh &amp; khởi tạo mã QR...
                  </span>
                </div>
              )}

              {qrState === 'ready' && sessionId && (
                <>
                  <div className="flex items-center gap-1.5 text-center">
                    <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${tc('text-[#aaa]', 'text-[#555]')}`}>
                      📱 Quét mã QR để xem &amp; tải trên điện thoại
                    </span>
                  </div>

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
              )}

              {qrState === 'error' && (
                <div className="py-4 flex flex-col items-center gap-2.5 text-center">
                  <span className="text-xs text-red-400 font-medium">
                    {qrErrorMsg || 'Không thể tạo mã QR, thử lại nhé!'}
                  </span>
                  <button
                    onClick={handleCreateQR}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${btnSecondaryClass}`}
                  >
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
