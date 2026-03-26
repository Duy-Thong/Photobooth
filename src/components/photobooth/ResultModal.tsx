import { useEffect, useState, useRef } from 'react'
import { Modal, QRCode, Spin, Button, message } from 'antd'
import { DownloadOutlined, ReloadOutlined, PictureOutlined, LoadingOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { uploadSession } from '@/lib/uploadService'
import { downloadImage } from '@/lib/imageProcessing'

type Phase = 'uploading' | 'done' | 'error'

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
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [recapStripFirebaseUrl, setRecapStripFirebaseUrl] = useState<string | null>(null)
  const [finalWithQr, setFinalWithQr] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [currentClipIdx, setCurrentClipIdx] = useState(0)
  // Incremented each time the user explicitly triggers an upload.
  // Used as the effect dep so phase changes mid-async don't cancel the run.
  const [uploadKey, setUploadKey] = useState(0)
  const [copied, setCopied] = useState(false)

  const handleCopyUrl = () => {
    const url = `${window.location.origin}/session/${sessionId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      message.success('Đã copy link!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (!open || !imageBlobUrl) return
    // Reset and start uploading immediately
    setPhase('uploading')
    setSessionId(null)
    setRecapStripFirebaseUrl(null)
    setFinalWithQr(null)
    setErrorMsg(null)
    setCurrentClipIdx(0)
    setUploadKey(k => k + 1)
  }, [open, imageBlobUrl])

  const lastUploadKeyRef = useRef(0)

  // Upload flow — only starts when user explicitly triggers via uploadKey
  useEffect(() => {
    if (uploadKey === 0 || !imageBlobUrl) return
    if (buildingStrip) return
    if (lastUploadKeyRef.current === uploadKey) return

    lastUploadKeyRef.current = uploadKey

    let cancelled = false

    async function run() {
      try {
        const result = await uploadSession(
          imageBlobUrl!,
          recapStripUrl ?? null,
          recapMimeType ?? undefined,
        )
        if (cancelled) return
        setSessionId(result.sessionId)
        setFinalWithQr(result.stampedBlobUrl)
        // recapStripFirebaseUrl is now inside the session, derive it
        const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string
        if (recapStripUrl) {
          const ext = (recapMimeType ?? 'video/webm').startsWith('video/mp4') ? 'mp4' : 'webm'
          setRecapStripFirebaseUrl(
            `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(`sessions/${result.sessionId}/strip.${ext}`)}?alt=media`
          )
        }
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
      {/* ── LOADING ─────────────────────────────────────────────────────────── */}
      {phase === 'uploading' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spin size="large" />
          <p className="text-[#888] text-sm">Đang xử lý QR...</p>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <div className="flex gap-2 mt-2">
            <Button onClick={onClose} style={{ ...btnBase, color: '#888' }}>Đóng</Button>
            <Button onClick={handleStartUpload}
              style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}>
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {/* ── DONE ─────────────────────────────────────────────────────────────── */}
      {phase === 'done' && finalWithQr && sessionId && (
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
            <div className="p-2 rounded-2xl">
              <QRCode value={`${window.location.origin}/session/${sessionId}`} size={150} bordered={false} errorLevel="H" icon="/clublogo.png" iconSize={34} />
            </div>
            {/* URL copy row */}
            <div className="w-full flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
              <span className="flex-1 text-[#888] text-xs truncate select-all">
                {`${window.location.origin}/session/${sessionId}`}
              </span>
              <button
                onClick={handleCopyUrl}
                className="shrink-0 text-[#666] hover:text-white transition-colors p-0.5"
                title="Copy link"
              >
                {copied ? <CheckOutlined className="text-green-400" /> : <CopyOutlined />}
              </button>
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
