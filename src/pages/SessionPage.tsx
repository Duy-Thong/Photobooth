import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, Modal, QRCode, message } from 'antd'
import {
  LoadingOutlined,
  PrinterOutlined,
  DownloadOutlined,
  CopyOutlined,
  CheckOutlined,
  ShareAltOutlined,
  CameraOutlined,
} from '@ant-design/icons'
import { fetchSession, type SessionData } from '@/lib/sessionService'
import { downloadMedia } from '@/lib/imageProcessing'
import { useThemeClass } from '@/stores/themeStore'
import ThemeToggle from '@/components/photobooth/ThemeToggle'
import RecruitmentBanner from '@/components/photobooth/RecruitmentBanner'

export default function SessionPage() {
  const tc = useThemeClass()
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [downloadingPhoto, setDownloadingPhoto] = useState(false)
  const [downloadingVideo, setDownloadingVideo] = useState(false)
  const [copied, setCopied] = useState(false)

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    if (!id) return
    fetchSession(id)
      .then(s => {
        setSession(s)
        if (!s) setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true)
      message.success('Đã copy link!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Sổ Media Photobooth',
          text: 'Xem bộ ảnh photobooth siêu xinh của mình nè! ✨',
          url: currentUrl,
        })
      } catch {
        // User cancelled
      }
    } else {
      handleCopyUrl()
    }
  }

  if (loading) {
    return (
      <div className={`min-h-dvh flex items-center justify-center ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className={`min-h-dvh flex flex-col items-center justify-center gap-3 text-center px-6 ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
        <p className="text-4xl">📷</p>
        <p className={`font-bold text-lg ${tc('text-white', 'text-black')}`}>Không tìm thấy ảnh</p>
        <p className={`text-sm ${tc('text-[#666]', 'text-[#888]')}`}>Link này không tồn tại hoặc đã hết hạn.</p>
        <a
          href="/"
          className={`mt-4 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${tc(
            'bg-[#141414] hover:bg-[#222] text-white border-[#333]',
            'bg-white hover:bg-[#eee] text-black border-[#d9d9d9]'
          )}`}
        >
          Về trang chủ Photobooth
        </a>
      </div>
    )
  }

  const date = new Date(session.createdAt).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const handleDownloadPhoto = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (downloadingPhoto) return
    setDownloadingPhoto(true)
    try {
      await downloadMedia(session.imageUrl, `somedia-${session.id}.jpg`)
    } finally {
      setDownloadingPhoto(false)
    }
  }

  const handleDownloadVideo = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (downloadingVideo) return
    if (session.videoUrl) {
      setDownloadingVideo(true)
      try {
        const ext = session.videoUrl.includes('.mp4') ? 'mp4' : 'webm'
        await downloadMedia(session.videoUrl, `somedia-video-${session.id}.${ext}`)
      } finally {
        setDownloadingVideo(false)
      }
    }
  }

  const handlePrint = () => {
    const style = document.createElement('style')
    style.innerHTML = `
      @page { size: 4in 6in portrait; margin: 3mm; }
      @media print {
        body > *:not(#__print_frame) { display: none !important; }
        #__print_frame {
          display: flex !important;
          position: fixed; inset: 0;
          justify-content: center; align-items: center;
          background: white;
        }
        #__print_frame img { max-width: 100%; max-height: 100%; object-fit: contain; }
      }
    `
    const frame = document.createElement('div')
    frame.id = '__print_frame'
    frame.style.display = 'none'
    const img = document.createElement('img')
    img.src = session.imageUrl
    frame.appendChild(img)
    document.head.appendChild(style)
    document.body.appendChild(frame)
    const cleanup = () => {
      style.remove()
      frame.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    const doPrint = () => window.print()
    if (img.complete && img.naturalWidth > 0) {
      doPrint()
    } else {
      img.onload = doPrint
      img.onerror = () => {
        cleanup()
        Modal.error({ title: 'Không thể tải ảnh để in', centered: true })
      }
    }
  }

  const smallBtnClass = tc(
    'bg-[#1a1a1a] border border-[#2e2e2e] text-[#aaa] hover:text-white hover:border-[#444] hover:bg-[#252525]',
    'bg-white border border-[#d9d9d9] text-[#666] hover:text-black hover:border-[#999] hover:bg-[#f5f5f5]'
  )

  return (
    <div className={`min-h-dvh flex flex-col items-center py-8 px-4 gap-6 ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-1 text-center">
        <a href="/" className={`font-bold text-2xl tracking-tight ${tc('text-white', 'text-black')}`} style={{ letterSpacing: '-0.04em' }}>
          Sổ Media
        </a>
        <p className={`text-[10px] uppercase tracking-[0.25em] font-medium ${tc('text-[#777]', 'text-[#999]')}`}>Photobooth Studio</p>
        <p className={`text-xs mt-1 font-mono ${tc('text-[#555]', 'text-[#aaa]')}`}>{date}</p>
      </div>

      {/* Strip image */}
      <div className="w-full max-w-xs">
        <div className={`rounded-2xl border p-2 shadow-2xl ${tc('bg-[#111] border-[#222]', 'bg-white border-[#e0e0e0]')}`}>
          <img
            src={session.imageUrl}
            alt="Photo strip"
            className="w-full rounded-xl object-contain"
            crossOrigin="anonymous"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-xs flex flex-col gap-2.5">
        <button
          onClick={handleDownloadPhoto}
          disabled={downloadingPhoto}
          className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${tc(
            'bg-white text-black hover:bg-[#eaeaea] active:scale-[0.98]',
            'bg-black text-white hover:bg-[#222] active:scale-[0.98]'
          )}`}
        >
          {downloadingPhoto ? <LoadingOutlined /> : <DownloadOutlined style={{ fontSize: 16 }} />}
          Tải ảnh về máy
        </button>

        <button
          onClick={handlePrint}
          className={`w-full h-10 flex items-center justify-center gap-2 rounded-xl font-semibold text-xs transition-all cursor-pointer border ${tc(
            'bg-[#141414] text-[#ddd] hover:text-white hover:bg-[#1f1f1f] border-[#2e2e2e]',
            'bg-white text-[#333] hover:text-black hover:bg-[#fafafa] border-[#d9d9d9]'
          )}`}
        >
          <PrinterOutlined /> In ảnh (khổ 10x15cm)
        </button>
      </div>

      {/* Strip video (if present) */}
      {session.videoUrl && (
        <div className="w-full max-w-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className={`text-[10px] uppercase tracking-wider font-bold ${tc('text-[#888]', 'text-[#777]')}`}>
            </span>
          </div>
          <video
            src={session.videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className={`w-full rounded-2xl border shadow-lg ${tc('border-[#222] bg-black', 'border-[#d9d9d9] bg-white')}`}
          />
          <button
            onClick={handleDownloadVideo}
            disabled={downloadingVideo}
            className={`w-full h-10 flex items-center justify-center gap-2 rounded-xl font-semibold text-xs transition-all cursor-pointer border disabled:opacity-70 disabled:cursor-not-allowed ${tc(
              'bg-[#141414] text-[#ddd] hover:text-white hover:bg-[#1f1f1f] border-[#2e2e2e]',
              'bg-white text-[#333] hover:text-black hover:bg-[#fafafa] border-[#d9d9d9]'
            )}`}
          >
            {downloadingVideo ? <LoadingOutlined /> : <DownloadOutlined />} Tải video recap
          </button>
        </div>
      )}

      {/* QR Code & Share Card below */}
      <div
        className={`w-full max-w-xs rounded-2xl border p-5 flex flex-col items-center gap-3.5 shadow-xl ${tc(
          'bg-[#111] border-[#222]',
          'bg-white border-[#e0e0e0]'
        )}`}
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <span className={`text-xs font-bold uppercase tracking-wider ${tc('text-white', 'text-black')}`}>
            Mã QR
          </span>
        </div>

        <div className="p-3 bg-white rounded-2xl shadow-sm inline-flex items-center justify-center border border-gray-200">
          <QRCode
            value={currentUrl}
            size={145}
            bordered={false}
            errorLevel="H"
            color="#000000"
            bgColor="#ffffff"
            icon="/clublogo.png"
            iconSize={36}
          />
        </div>

        {/* URL row + Copy + Share */}
        <div className={`w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 rounded-xl p-2 sm:pl-3 border ${tc('bg-[#0a0a0a] border-[#222]', 'bg-[#f5f5f5] border-[#d9d9d9]')}`}>
          <span className={`flex-1 text-[11px] truncate select-all font-mono ${tc('text-[#888]', 'text-[#666]')}`}>
            {currentUrl}
          </span>
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <button
              onClick={handleCopyUrl}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${smallBtnClass}`}
              title="Copy link"
            >
              {copied ? <CheckOutlined className="text-green-400" /> : <CopyOutlined />}
              Copy
            </button>
            <button
              onClick={handleShare}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${smallBtnClass}`}
              title="Chia sẻ"
            >
              <ShareAltOutlined />
            </button>
          </div>
        </div>
      </div>

      {/* Recruitment Banner Card */}
      <div className="w-full max-w-xs">
        <RecruitmentBanner variant="card" />
      </div>

      {/* CTA: Back to Photobooth */}
      <a
        href="/"
        className={`w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-xs transition-all border ${tc(
          'bg-[#141414] hover:bg-[#1c1c1c] text-white/90 border-[#2a2a2a]',
          'bg-white hover:bg-[#f0f0f0] text-black/90 border-[#d9d9d9]'
        )}`}
      >
        <CameraOutlined /> Tự chụp bộ ảnh của riêng bạn
      </a>

      <p className={`text-[10px] pb-6 ${tc('text-[#333]', 'text-[#bbb]')}`}>somedia · photobooth</p>
    </div>
  )
}
