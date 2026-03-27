import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, Modal } from 'antd'
import { LoadingOutlined, PrinterOutlined } from '@ant-design/icons'
import { fetchSession, type SessionData } from '@/lib/sessionService'
import { downloadMedia } from '@/lib/imageProcessing'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const [downloadingPhoto, setDownloadingPhoto] = useState(false)
  const [downloadingVideo, setDownloadingVideo] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchSession(id)
      .then(s => { setSession(s); if (!s) setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">📷</p>
        <p className="text-white font-semibold text-lg">Không tìm thấy ảnh</p>
        <p className="text-[#555] text-sm">Link này không tồn tại hoặc đã bị xoá.</p>
        <a href="/" className="mt-4 text-xs text-[#444] hover:text-[#888] underline transition-colors">
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
    const win = window.open('', '_blank')
    if (!win) {
      Modal.error({ title: 'Không thể mở cửa sổ in', content: 'Vui lòng tắt trình chặn popup và thử lại.', centered: true })
      return
    }
    win.document.write(`
      <html>
        <head>
          <title>In ảnh - Somedia Session</title>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: start; background: white; }
            img { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img id="print-image" src="${session.imageUrl}" />
          <script>
            const img = document.getElementById('print-image');
            const doPrint = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
            if (img.complete) {
              doPrint();
            } else {
              img.onload = doPrint;
              img.onerror = () => {
                alert('Không thể tải ảnh để in.');
                window.close();
              };
            }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center py-10 px-4 gap-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-1">
        <a href="/" className="text-white font-bold text-xl tracking-tight" style={{ letterSpacing: '-0.04em' }}>
          Sổ Media
        </a>
        <p className="text-[#444] text-[10px] uppercase tracking-[0.2em]">Photobooth</p>
        <p className="text-[#333] text-xs mt-2">{date}</p>
      </div>

      {/* Strip image */}
      <div className="w-full max-w-xs">
        <img
          src={session.imageUrl}
          alt="Photo strip"
          className="w-full rounded-2xl shadow-2xl border border-[#1a1a1a]"
          crossOrigin="anonymous"
        />
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2">
        <button
          onClick={handleDownloadPhoto}
          disabled={downloadingPhoto}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-[#eee] transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {downloadingPhoto ? <LoadingOutlined /> : '↓ Tải ảnh'}
        </button>
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a1a1a] text-white font-semibold text-sm hover:bg-[#222] transition-colors cursor-pointer border border-[#333]"
        >
          <PrinterOutlined /> In ảnh
        </button>
      </div>

      {/* Strip video */}
      {session.videoUrl && (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <p className="text-[#555] text-[10px] uppercase tracking-[0.2em] text-center">Strip Video</p>
          <video
            src={session.videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full rounded-xl border border-[#1a1a1a] bg-black"
          />
          <button
            onClick={handleDownloadVideo}
            disabled={downloadingVideo}
            className="w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-[#eee] transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {downloadingVideo ? <LoadingOutlined /> : 'Tải video'}
          </button>
        </div>
      )}

      <p className="text-[#2a2a2a] text-[10px] pb-6">somedia · photobooth</p>
    </div>
  )
}
