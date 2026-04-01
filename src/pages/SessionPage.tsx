import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, Modal, Tour, type TourProps } from 'antd'
import { LoadingOutlined, PrinterOutlined } from '@ant-design/icons'
import { fetchSession, type SessionData } from '@/lib/sessionService'
import { downloadMedia, isMobileDevice } from '@/lib/imageProcessing'
import { useThemeClass } from '@/stores/themeStore'
import ThemeToggle from '@/components/photobooth/ThemeToggle'

export default function SessionPage() {
  const tc = useThemeClass()
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const [downloadingPhoto, setDownloadingPhoto] = useState(false)
  const [downloadingVideo, setDownloadingVideo] = useState(false)

  const [tourOpen, setTourOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchSession(id)
      .then(s => { setSession(s); if (!s) setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!loading && session) {
      const seen = localStorage.getItem('photobooth-session-tour-seen')
      if (!seen) {
        setTourOpen(true)
      }
    }
  }, [loading, session])

  const tourSteps: TourProps['steps'] = [
    {
      title: 'Chào mừng 🎉',
      description: 'Đây là trang nhận ảnh của bạn. Tại đây bạn có thể xem lại và lưu giữ những khoảnh khắc vừa chụp.',
      target: null,
    },
    {
      title: 'Dải ảnh của bạn',
      description: 'Đây là bộ ảnh hoàn chỉnh đã được ghép khung. Bạn có thể nhấn giữ để lưu hoặc chia sẻ link này.',
      target: () => document.getElementById('tour-session-photo')!,
    },
    {
      title: 'Tải ảnh',
      description: 'Nhấn vào đây để tải ảnh chất lượng cao về máy.',
      target: () => document.getElementById('tour-session-download-photo')!,
    },
    {
      title: 'In ảnh',
      description: 'Nếu có máy in kết nối, bạn có thể in ảnh ngay tại đây.',
      target: () => document.getElementById('tour-session-print-photo')!,
    },
    ...(session?.videoUrl ? [{
      title: 'Strip Video',
      description: 'Đây là đoạn clip ngắn ghi lại quá trình chụp ảnh của bạn. Một món quà nhỏ từ chúng mình!',
      target: () => document.getElementById('tour-session-video')!,
    },
    {
      title: 'Tải video',
      description: 'Bạn cũng có thể tải đoạn video này về để làm kỷ niệm nhé.',
      target: () => document.getElementById('tour-session-download-video')!,
    }] : []),
  ]

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
        <p className={`font-semibold text-lg ${tc('text-white', 'text-black')}`}>Không tìm thấy ảnh</p>
        <p className={`text-sm ${tc('text-[#555]', 'text-[#999]')}`}>Link này không tồn tại hoặc đã bị xoá.</p>
        <a href="/" className={`mt-4 text-xs underline transition-colors ${tc('text-[#444] hover:text-[#888]', 'text-[#bbb] hover:text-[#666]')}`}>
          Về trang chủ
        </a>
      </div>
    )
  }

  const date = new Date(session.createdAt).toLocaleString('vi-VN', {
    dateStyle: 'short', timeStyle: 'short',
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
      style.remove(); frame.remove()
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

  return (
    <div className={`min-h-dvh flex flex-col items-center py-10 px-4 gap-8 ${tc('bg-[#0a0a0a]', 'bg-[#f5f5f5]')}`}>
      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-1">
        <a href="/" className={`font-bold text-xl tracking-tight ${tc('text-white', 'text-black')}`} style={{ letterSpacing: '-0.04em' }}>
          Sổ Media
        </a>
        <p className={`text-[10px] uppercase tracking-[0.2em] ${tc('text-[#444]', 'text-[#bbb]')}`}>Photobooth</p>
        <p className={`text-xs mt-2 ${tc('text-[#333]', 'text-[#ccc]')}`}>{date}</p>
      </div>

      {/* Strip image */}
      <div className="w-full max-w-xs">
        <img
          id="tour-session-photo"
          src={session.imageUrl}
          alt="Photo strip"
          className={`w-full rounded-2xl shadow-2xl border ${tc('border-[#222]', 'border-[#d9d9d9]')}`}
          crossOrigin="anonymous"
        />
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2">
        <button
          id="tour-session-download-photo"
          onClick={handleDownloadPhoto}
          disabled={downloadingPhoto}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${tc(
            'bg-white text-black hover:bg-[#eee]',
            'bg-black text-white hover:bg-[#222]'
          )}`}
        >
          {downloadingPhoto ? <LoadingOutlined /> : '↓ Tải ảnh'}
        </button>
        <button
          id="tour-session-print-photo"
          onClick={handlePrint}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors cursor-pointer border ${tc(
            'bg-[#0a0a0a] text-white hover:bg-[#111] border-[#333]',
            'bg-white text-black hover:bg-[#f5f5f5] border-[#d9d9d9]'
          )}`}
        >
          <PrinterOutlined /> In ảnh
        </button>
        {isMobileDevice() && (
          <p className={`text-[10px] text-center mt-1 opacity-50 ${tc('text-[#555]', 'text-[#999]')}`}>
            Mẹo: Nhấn giữ ảnh hoặc nút Tải về để lưu vào thư viện.
          </p>
        )}
      </div>

      {/* Strip video */}
      {session.videoUrl && (
        <div id="tour-session-video" className="w-full max-w-xs flex flex-col gap-3">
          <p className={`text-[10px] uppercase tracking-[0.2em] text-center ${tc('text-[#555]', 'text-[#999]')}`}>Strip Video</p>
          <video
            src={session.videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className={`w-full rounded-xl border ${tc('border-[#222] bg-black', 'border-[#d9d9d9] bg-white')}`}
          />
          <button
            id="tour-session-download-video"
            onClick={handleDownloadVideo}
            disabled={downloadingVideo}
            className={`w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${tc(
              'bg-white text-black hover:bg-[#eee]',
              'bg-black text-white hover:bg-[#222]'
            )}`}
          >
            {downloadingVideo ? <LoadingOutlined /> : 'Tải video'}
          </button>
        </div>
      )}

      <p className={`text-[10px] pb-6 ${tc('text-[#2a2a2a]', 'text-[#ccc]')}`}>somedia · photobooth</p>

      <Tour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false)
          localStorage.setItem('photobooth-session-tour-seen', 'true')
        }}
        steps={tourSteps}
        getPopupContainer={() => document.body}
      />
    </div>
  )
}
