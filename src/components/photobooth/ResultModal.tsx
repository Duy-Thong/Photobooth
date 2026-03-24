import { useEffect, useState } from 'react'
import { Modal, QRCode, Spin, Button } from 'antd'
import { DownloadOutlined, ReloadOutlined, PictureOutlined } from '@ant-design/icons'
import { uploadPhotoToFirebase, uploadVideoToFirebase } from '@/lib/uploadService'
import { stampQrOnImage, downloadImage } from '@/lib/imageProcessing'

type Phase = 'confirm' | 'uploading' | 'stamping' | 'done' | 'error'

interface ResultModalProps {
  open: boolean
  /** blob URL of the final composited strip (without QR) */
  imageBlobUrl: string | null
  /** object URL of the webm video recap (optional) */
  recapVideoUrl?: string | null
  onClose: () => void
  onRetake: () => void
  onChangeFrame: () => void
}

export default function ResultModal({ open, imageBlobUrl, recapVideoUrl, onClose, onRetake, onChangeFrame }: ResultModalProps) {
  const [phase, setPhase] = useState<Phase>('uploading')
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null)
  const [recapFirebaseUrl, setRecapFirebaseUrl] = useState<string | null>(null)
  const [finalWithQr, setFinalWithQr] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !imageBlobUrl) return
    // Reset and wait for user confirmation before uploading
    setPhase('confirm')
    setFirebaseUrl(null)
    setRecapFirebaseUrl(null)
    setFinalWithQr(null)
    setErrorMsg(null)
  }, [open, imageBlobUrl])

  // Upload flow — only starts when user explicitly sets phase to 'uploading'
  useEffect(() => {
    if (phase !== 'uploading' || !imageBlobUrl) return

    let cancelled = false

    async function run() {
      try {
        // Step 1: Upload photo + video in parallel
        const [photoUrl, videoUrl] = await Promise.all([
          uploadPhotoToFirebase(imageBlobUrl!),
          recapVideoUrl ? uploadVideoToFirebase(recapVideoUrl) : Promise.resolve(null),
        ])
        if (cancelled) return
        setFirebaseUrl(photoUrl)
        if (videoUrl) setRecapFirebaseUrl(videoUrl)

        // Step 2: Stamp QR onto the image
        setPhase('stamping')
        const withQr = await stampQrOnImage(imageBlobUrl!, photoUrl)
        if (cancelled) return
        setFinalWithQr(withQr)
        setPhase('done')
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Upload thất bại')
          setPhase('error')
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [phase, imageBlobUrl, recapVideoUrl])

  const handleDownload = () => {
    const src = finalWithQr || imageBlobUrl
    if (src) downloadImage(src, `some-media-${Date.now()}.jpg`)
  }

  const handleStartUpload = () => setPhase('uploading')

  const handleRetake = () => {
    onClose()
    onRetake()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span className="text-white font-semibold tracking-tight">
          {phase === 'confirm' && 'Ảnh của bạn'}
          {phase === 'uploading' && 'Đang tải lên...'}
          {phase === 'stamping' && 'Đang tạo QR...'}
          {phase === 'done' && 'Ảnh của bạn đã sẵn sàng'}
          {phase === 'error' && 'Có lỗi xảy ra'}
        </span>
      }
      footer={
        phase === 'confirm' ? (
          <div className="flex justify-between items-center">
            <Button
              onClick={handleRetake}
              style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}
            >
              <ReloadOutlined /> Chụp lại
            </Button>
            <div className="flex gap-2">
              <Button
                icon={<PictureOutlined />}
                onClick={onChangeFrame}
                style={{ background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #333' }}
              >
                Đổi khung
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                style={{ background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #333' }}
              >
                Tải về
              </Button>
              <Button
                onClick={handleStartUpload}
                style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}
              >
                Upload &amp; Lấy QR
              </Button>
            </div>
          </div>
        ) : phase === 'done' ? (
          <div className="flex justify-between items-center">
            <Button
              onClick={handleRetake}
              style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}
            >
              <ReloadOutlined /> Chụp lại
            </Button>
            <div className="flex gap-2">
              <Button
                icon={<PictureOutlined />}
                onClick={onChangeFrame}
                style={{ background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #333' }}
              >
                Đổi khung
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}
              >
                Tải về
              </Button>
            </div>
          </div>
        ) : phase === 'error' ? (
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} style={{ background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' }}>
              Đóng
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              style={{ background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #333' }}
            >
              Tải về (không có QR)
            </Button>
          </div>
        ) : null
      }
      width={480}
      centered
      styles={{
        body: { background: '#141414', padding: '16px' },
        header: { background: '#141414', borderBottom: '1px solid #2a2a2a' },
        footer: { background: '#141414', borderTop: '1px solid #2a2a2a' },
      }}
    >
      {/* Confirm — show preview, let user decide whether to upload */}
      {phase === 'confirm' && imageBlobUrl && (
        <div className="flex flex-col items-center gap-4">
          <img
            src={imageBlobUrl}
            alt="Preview"
            className="max-w-full max-h-100 object-contain rounded-lg border border-[#2a2a2a]"
          />
          <p className="text-[#555] text-xs text-center">
            Nhấn <span className="text-white font-medium">Upload &amp; Lấy QR</span> để lưu lên đám mây và nhận mã QR chia sẻ.
            <br />Hoặc <span className="text-white font-medium">Tải về</span> trực tiếp không cần upload.
          </p>
        </div>
      )}

      {/* Loading phases */}
      {(phase === 'uploading' || phase === 'stamping') && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Spin size="large" />
          <p className="text-[#888] text-sm">
            {phase === 'uploading' ? 'Đang upload ảnh lên Firebase...' : 'Đang ghép QR vào ảnh...'}
          </p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <p className="text-[#555] text-xs">Bạn vẫn có thể tải ảnh về (không có QR)</p>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && finalWithQr && firebaseUrl && (
        <div className="flex flex-col items-center gap-5">
          {/* Preview */}
          <img
            src={finalWithQr}
            alt="Final photo"
            className="max-w-full max-h-[360px] object-contain rounded-lg border border-[#2a2a2a]"
          />

          {/* Video recap */}
          {recapVideoUrl && (
            <div className="w-full flex flex-col items-center gap-3">
              <p className="text-[#888] text-xs uppercase tracking-widest">Video Recap</p>
              <video
                src={recapVideoUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full max-h-[220px] rounded-lg border border-[#2a2a2a] bg-black object-contain"
              />
              {recapFirebaseUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[#888] text-xs uppercase tracking-widest">Quét để xem video</p>
                  <div className="bg-white p-2 rounded-xl">
                    <QRCode value={recapFirebaseUrl} size={110} bordered={false} />
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={recapVideoUrl}
                      download={`somedia-recap-${Date.now()}.webm`}
                      className="text-[#555] hover:text-white text-xs underline transition-colors"
                    >
                      Tải về (local)
                    </a>
                    <a
                      href={recapFirebaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#555] hover:text-white text-xs underline transition-colors"
                    >
                      Link Firebase ↗
                    </a>
                  </div>
                </div>
              ) : (
                <a
                  href={recapVideoUrl}
                  download={`somedia-recap-${Date.now()}.webm`}
                  className="text-[#555] hover:text-white text-xs underline transition-colors"
                >
                  Tải về (local)
                </a>
              )}
            </div>
          )}

          {/* QR standalone for easy scanning */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[#888] text-xs uppercase tracking-widest">Quét để xem & chia sẻ</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCode
                value={firebaseUrl}
                size={140}
                bordered={false}
              />
            </div>
            <p className="text-[#444] text-[10px] max-w-[280px] text-center break-all">{firebaseUrl}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
