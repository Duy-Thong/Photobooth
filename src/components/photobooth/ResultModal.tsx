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
  /** object URL of the video recap (optional) */
  recapVideoUrl?: string | null
  /** MIME type of the recap video, e.g. 'video/mp4' or 'video/webm' */
  recapVideoMimeType?: string | null
  onClose: () => void
  onRetake: () => void
  onChangeFrame: () => void
}

export default function ResultModal({ open, imageBlobUrl, recapVideoUrl, recapVideoMimeType, onClose, onRetake, onChangeFrame }: ResultModalProps) {
  const recapExt = recapVideoMimeType?.startsWith('video/mp4') ? 'mp4' : 'webm'

  const [phase, setPhase] = useState<Phase>('uploading')
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null)
  const [recapFirebaseUrl, setRecapFirebaseUrl] = useState<string | null>(null)
  const [finalWithQr, setFinalWithQr] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Incremented each time the user explicitly triggers an upload.
  // Used as the effect dep so phase changes mid-async don't cancel the run.
  const [uploadKey, setUploadKey] = useState(0)

  useEffect(() => {
    if (!open || !imageBlobUrl) return
    // Reset and wait for user confirmation before uploading
    setPhase('confirm')
    setFirebaseUrl(null)
    setRecapFirebaseUrl(null)
    setFinalWithQr(null)
    setErrorMsg(null)
  }, [open, imageBlobUrl])

  // Upload flow — only starts when user explicitly triggers via uploadKey
  useEffect(() => {
    if (uploadKey === 0 || !imageBlobUrl) return

    let cancelled = false

    async function run() {
      try {
        // Step 1: Upload photo + video in parallel
        const [photoUrl, videoUrl] = await Promise.all([
          uploadPhotoToFirebase(imageBlobUrl!),
          recapVideoUrl ? uploadVideoToFirebase(recapVideoUrl, recapVideoMimeType ?? undefined) : Promise.resolve(null),
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
  // NOTE: 'phase' intentionally excluded — including it would cause the cleanup
  // to fire (cancelled=true) when phase changes from 'uploading' to 'stamping',
  // which would leave the modal stuck at the stamping screen permanently.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadKey, imageBlobUrl, recapVideoUrl, recapVideoMimeType])

  const handleDownload = () => {
    const src = finalWithQr || imageBlobUrl
    if (src) downloadImage(src, `some-media-${Date.now()}.jpg`)
  }

  const handleStartUpload = () => {
    setPhase('uploading')
    setUploadKey(k => k + 1)
  }

  const handleRetake = () => {
    onClose()
    onRetake()
  }

  const btnBase = { background: '#1e1e1e', border: '1px solid #2a2a2a' }

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
      footer={null}
      width={760}
      centered
      styles={{
        body: { background: '#141414', padding: '20px' },
        header: { background: '#141414', borderBottom: '1px solid #1f1f1f' },
      }}
    >
      {/* ── CONFIRM ─────────────────────────────────────────────────────────── */}
      {phase === 'confirm' && imageBlobUrl && (
        <div className="flex gap-5 items-start">
          {/* Left — photo preview */}
          <div className="flex-shrink-0 w-[280px] flex justify-center">
            <img
              src={imageBlobUrl}
              alt="Preview"
              className="w-full max-h-[480px] object-contain rounded-lg border border-[#2a2a2a]"
            />
          </div>

          {/* Right — video recap + actions */}
          <div className="flex-1 flex flex-col gap-4 justify-between min-h-[300px]">
            {recapVideoUrl ? (
              <div className="flex flex-col gap-2">
                <p className="text-[#666] text-[10px] uppercase tracking-widest">Video Recap</p>
                <video
                  src={recapVideoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-lg border border-[#2a2a2a] bg-black object-contain"
                />
                <a
                  href={recapVideoUrl}
                  download={`somedia-recap-${Date.now()}.${recapExt}`}
                  className="text-[#555] hover:text-white text-xs underline transition-colors text-center"
                >
                  Tải video về máy (offline)
                </a>
              </div>
            ) : (
              <p className="text-[#444] text-xs text-center mt-4">
                Nhấn <span className="text-white font-medium">Upload &amp; Lấy QR</span> để lưu lên đám mây.<br />
                Hoặc <span className="text-white font-medium">Tải về</span> ngay không cần upload.
              </p>
            )}

            <div className="flex flex-col gap-2 mt-auto">
              <Button
                block
                onClick={handleStartUpload}
                style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600, height: 40 }}
              >
                Upload &amp; Lấy QR
              </Button>
              <Button block icon={<DownloadOutlined />} onClick={handleDownload}
                style={{ ...btnBase, color: '#e5e5e5', height: 36 }}>
                Tải về không cần QR
              </Button>
              <div className="flex gap-2">
                <Button icon={<PictureOutlined />} onClick={onChangeFrame}
                  style={{ ...btnBase, color: '#888', flex: 1 }}>
                  Đổi khung
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleRetake}
                  style={{ ...btnBase, color: '#888', flex: 1 }}>
                  Chụp lại
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LOADING ──────────────────────────────────────────────────────────── */}
      {(phase === 'uploading' || phase === 'stamping') && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spin size="large" />
          <p className="text-[#888] text-sm">
            {phase === 'uploading' ? 'Đang upload ảnh lên Firebase...' : 'Đang ghép QR vào ảnh...'}
          </p>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <p className="text-[#555] text-xs">Bạn vẫn có thể tải ảnh về (không có QR)</p>
          <div className="flex gap-2 mt-2">
            <Button onClick={onClose} style={{ ...btnBase, color: '#888' }}>Đóng</Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownload}
              style={{ ...btnBase, color: '#e5e5e5' }}>
              Tải về (không QR)
            </Button>
          </div>
        </div>
      )}

      {/* ── DONE ─────────────────────────────────────────────────────────────── */}
      {phase === 'done' && finalWithQr && firebaseUrl && (
        <div className="flex gap-6 items-start">
          {/* Left — final photo with QR already stamped */}
          <div className="flex-shrink-0 w-[280px] flex justify-center">
            <img
              src={finalWithQr}
              alt="Final photo"
              className="w-full max-h-[520px] object-contain rounded-lg border border-[#2a2a2a]"
            />
          </div>

          {/* Right — QR + actions */}
          <div className="flex-1 flex flex-col items-center gap-4">
            <p className="text-[#666] text-[10px] uppercase tracking-widest self-start">Quét để xem &amp; chia sẻ</p>
            <div className="p-3 rounded-2xl">
              <QRCode value={firebaseUrl} size={200} bordered={false} errorLevel="H" icon="/clublogo.png" iconSize={44} />
            </div>

            {/* Video recap */}
            {recapVideoUrl && (
              <div className="w-full flex flex-col gap-2">
                <p className="text-[#666] text-[10px] uppercase tracking-widest">Video Recap</p>
                <video
                  src={recapVideoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-lg border border-[#2a2a2a] bg-black object-contain"
                />
                {recapFirebaseUrl && (
                  <div className="flex items-center justify-center gap-3">
                    <a href={recapVideoUrl} download={`somedia-recap-${Date.now()}.${recapExt}`}
                      className="text-[#555] hover:text-white text-xs underline transition-colors">
                      Tải về (local)
                    </a>
                    <a href={recapFirebaseUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[#555] hover:text-white text-xs underline transition-colors">
                      Link Firebase ↗
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="w-full flex flex-col gap-2 mt-auto">
              <Button block icon={<DownloadOutlined />} onClick={handleDownload}
                style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600, height: 40 }}>
                Tải về
              </Button>
              <div className="flex gap-2">
                <Button icon={<PictureOutlined />} onClick={onChangeFrame}
                  style={{ ...btnBase, color: '#888', flex: 1 }}>
                  Đổi khung
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleRetake}
                  style={{ ...btnBase, color: '#888', flex: 1 }}>
                  Chụp lại
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
