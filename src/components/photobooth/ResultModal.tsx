import { useEffect, useState } from 'react'
import { Modal, QRCode, Spin, Button } from 'antd'
import { DownloadOutlined, ReloadOutlined, PictureOutlined, LoadingOutlined } from '@ant-design/icons'
import { uploadPhotoWithQr, uploadVideoToFirebase } from '@/lib/uploadService'
import { downloadImage } from '@/lib/imageProcessing'

type Phase = 'confirm' | 'uploading' | 'done' | 'error'

interface ResultModalProps {
  open: boolean
  /** blob URL of the final composited strip (without QR) */
  imageBlobUrl: string | null
  /** One blob URL per captured slot (from per-slot recording) */
  recapClips?: string[]
  /** MIME type shared across all clips, e.g. 'video/mp4' or 'video/webm' */
  recapMimeType?: string | null
  /** Combined strip video with frame overlay */
  recapStripUrl?: string | null
  /** True while buildStripVideo is still running */
  buildingStrip?: boolean
  onClose: () => void
  onRetake: () => void
  onChangeFrame: () => void
}

export default function ResultModal({ open, imageBlobUrl, recapClips, recapMimeType, recapStripUrl, buildingStrip, onClose, onRetake, onChangeFrame }: ResultModalProps) {
  const recapExt = recapMimeType?.startsWith('video/mp4') ? 'mp4' : 'webm'
  const hasClips = !!recapClips && recapClips.length > 0

  const [phase, setPhase] = useState<Phase>('uploading')
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null)
  const [recapStripFirebaseUrl, setRecapStripFirebaseUrl] = useState<string | null>(null)
  const [finalWithQr, setFinalWithQr] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [currentClipIdx, setCurrentClipIdx] = useState(0)
  // Incremented each time the user explicitly triggers an upload.
  // Used as the effect dep so phase changes mid-async don't cancel the run.
  const [uploadKey, setUploadKey] = useState(0)

  useEffect(() => {
    if (!open || !imageBlobUrl) return
    // Reset and wait for user confirmation before uploading
    setPhase('confirm')
    setFirebaseUrl(null)
    setRecapStripFirebaseUrl(null)
    setFinalWithQr(null)
    setErrorMsg(null)
    setCurrentClipIdx(0)
  }, [open, imageBlobUrl])

  // Upload flow — only starts when user explicitly triggers via uploadKey
  useEffect(() => {
    if (uploadKey === 0 || !imageBlobUrl) return

    let cancelled = false

    async function run() {
      try {
        // Upload photo with QR already embedded + strip video in parallel
        const [photoResult, stripVideoUrl] = await Promise.all([
          uploadPhotoWithQr(imageBlobUrl!),
          recapStripUrl ? uploadVideoToFirebase(recapStripUrl, recapMimeType ?? undefined) : Promise.resolve(null),
        ])
        if (cancelled) return
        setFirebaseUrl(photoResult.publicUrl)
        setFinalWithQr(photoResult.stampedBlobUrl)
        if (stripVideoUrl) setRecapStripFirebaseUrl(stripVideoUrl)
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
  }, [uploadKey, imageBlobUrl, recapClips, recapMimeType, recapStripUrl])

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
          <div className="shrink-0 w-70 flex justify-center">
            <img
              src={imageBlobUrl}
              alt="Preview"
              className="w-full max-h-120 object-contain rounded-lg border border-[#2a2a2a]"
            />
          </div>

          {/* Right — video recap + actions */}
          <div className="flex-1 flex flex-col gap-3 justify-between min-h-75">
            {/* ── Strip video (combined, with frame) ── */}
            {(recapStripUrl || buildingStrip) && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[#666] text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                  Strip Video
                  {buildingStrip && !recapStripUrl && <LoadingOutlined className="text-[#555]" />}
                </p>
                {recapStripUrl ? (
                  <>
                    <video
                      src={recapStripUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full rounded-lg border border-[#2a2a2a] bg-black object-contain max-h-48"
                    />
                    <a
                      href={recapStripUrl}
                      download={`somedia-strip-${Date.now()}.${recapExt}`}
                      className="text-[#555] hover:text-white text-xs underline transition-colors text-center"
                    >
                      Tải strip video về máy
                    </a>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3 text-[#555] text-xs">
                    <LoadingOutlined />
                    <span>Đang tạo strip video...</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Individual clips (no frame) ── */}
            {hasClips && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[#666] text-[10px] uppercase tracking-widest">
                  Clip đơn ({currentClipIdx + 1}&nbsp;/&nbsp;{recapClips!.length})
                </p>
                <video
                  key={currentClipIdx}
                  src={recapClips![currentClipIdx]}
                  controls
                  autoPlay
                  playsInline
                  onEnded={() => setCurrentClipIdx(i => (i + 1) % recapClips!.length)}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-black object-contain max-h-32"
                />
                {recapClips!.length > 1 && (
                  <div className="flex gap-1.5 justify-center">
                    {recapClips!.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentClipIdx(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === currentClipIdx ? 'bg-white' : 'bg-[#444] hover:bg-[#666]'
                        }`}
                      />
                    ))}
                  </div>
                )}
                <a
                  href={recapClips![currentClipIdx]}
                  download={`somedia-clip-${currentClipIdx + 1}-${Date.now()}.${recapExt}`}
                  className="text-[#555] hover:text-white text-xs underline transition-colors text-center"
                >
                  Tải clip {currentClipIdx + 1} về máy
                </a>
              </div>
            )}

            {!recapStripUrl && !buildingStrip && !hasClips && (
              <p className="text-white text-xs text-center mt-4">
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
      {phase === 'uploading' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spin size="large" />
          <p className="text-[#888] text-sm">Đang upload ảnh lên Firebase...</p>
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
          {/* Left — photo preview with QR stamped */}
          <div className="shrink-0 w-70 flex justify-center">
            <img
              src={finalWithQr}
              alt="Final photo"
              className="w-full max-h-130 object-contain rounded-lg border border-[#2a2a2a]"
            />
          </div>

          {/* Right — QR + actions */}
          <div className="flex-1 flex flex-col items-center gap-4">
            <p className="text-[#666] text-[10px] uppercase tracking-widest self-start">Quét để xem &amp; chia sẻ</p>
            <div className="p-3 rounded-2xl">
              <QRCode value={firebaseUrl} size={200} bordered={false} errorLevel="H" icon="/clublogo.png" iconSize={44} />
            </div>

            {/* Video recap */}
            {(recapStripUrl || buildingStrip || hasClips) && (
              <div className="w-full flex flex-col gap-2">
                {/* Strip video */}
                {(recapStripUrl || buildingStrip) && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[#666] text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                      Strip Video
                      {buildingStrip && !recapStripUrl && <LoadingOutlined className="text-[#555]" />}
                    </p>
                    {recapStripUrl ? (
                      <>
                        <video
                          src={recapStripUrl}
                          controls
                          autoPlay
                          loop
                          playsInline
                          className="w-full rounded-lg border border-[#2a2a2a] bg-black object-contain max-h-44"
                        />
                        <div className="flex items-center justify-center gap-3">
                          <a href={recapStripUrl} download={`somedia-strip-${Date.now()}.${recapExt}`}
                            className="text-[#555] hover:text-white text-xs underline transition-colors">
                            Tải về (local)
                          </a>
                          {recapStripFirebaseUrl && (
                            <a href={recapStripFirebaseUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[#555] hover:text-white text-xs underline transition-colors">
                              Link Firebase ↗
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-3 text-[#555] text-xs">
                        <LoadingOutlined /><span>Đang tạo strip video...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Individual clips */}
                {hasClips && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <p className="text-[#666] text-[10px] uppercase tracking-widest">
                      Clip đơn ({currentClipIdx + 1}&nbsp;/&nbsp;{recapClips!.length})
                    </p>
                    <video
                      key={currentClipIdx}
                      src={recapClips![currentClipIdx]}
                      controls
                      autoPlay
                      playsInline
                      onEnded={() => setCurrentClipIdx(i => (i + 1) % recapClips!.length)}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-black object-contain max-h-28"
                    />
                    {recapClips!.length > 1 && (
                      <div className="flex gap-1.5 justify-center">
                        {recapClips!.map((_, i) => (
                          <button key={i} onClick={() => setCurrentClipIdx(i)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i === currentClipIdx ? 'bg-white' : 'bg-[#444] hover:bg-[#666]'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-3">
                      <a href={recapClips![currentClipIdx]} download={`somedia-clip-${currentClipIdx + 1}-${Date.now()}.${recapExt}`}
                        className="text-[#555] hover:text-white text-xs underline transition-colors">
                        Tải về (local)
                      </a>

                    </div>
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
