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

    // If we already have the result for THIS blob URL, don't reset everything.
    // This allows re-opening the modal without re-uploading or seeing a blank screen.
    if (imageBlobUrl === lastOpenedUrlRef.current) {
      if (phase === 'done' && sessionId && finalWithQr) return
      if (phase === 'uploading') return // Already working on it
    }

    lastOpenedUrlRef.current = imageBlobUrl
    
    // If we have cached data for this EXACT blob URL from a previous open/close, restore it
    if (imageBlobUrl === lastUploadedUrlRef.current && lastSessionIdRef.current && lastFinalWithQrRef.current) {
      setSessionId(lastSessionIdRef.current)
      setFinalWithQr(lastFinalWithQrRef.current)
      setPhase('done')
      return
    }

    // Otherwise, reset and start a new upload flow
    setPhase('uploading')
    setSessionId(null)
    setFinalWithQr(null)
    setErrorMsg(null)
    setCurrentClipIdx(0)
    setUploadKey(k => k + 1)
  }, [open, imageBlobUrl])

  const lastOpenedUrlRef = useRef<string | null>(null)
  const lastUploadKeyRef = useRef(0)
  const lastUploadedUrlRef = useRef<string | null>(null)
  const lastSessionIdRef = useRef<string | null>(null)
  const lastFinalWithQrRef = useRef<string | null>(null)
  const isUploadingRef = useRef(false)

  // Upload flow — only starts when user explicitly triggers via uploadKey
  useEffect(() => {
    if (uploadKey === 0 || !imageBlobUrl) return
    
    // 1. Wait if we're still building the strip video
    if (buildingStrip) return
    
    // 2. Prevent parallel uploads
    if (isUploadingRef.current) return

    // 3. Skip if this specific upload attempt was already handled
    if (lastUploadKeyRef.current === uploadKey) return
    
    // 4. Skip if the final result for this image is already stored
    if (lastUploadedUrlRef.current === imageBlobUrl && lastSessionIdRef.current) {
      if (sessionId !== lastSessionIdRef.current) setSessionId(lastSessionIdRef.current)
      if (finalWithQr !== lastFinalWithQrRef.current) setFinalWithQr(lastFinalWithQrRef.current)
      setPhase('done')
      return
    }

    lastUploadKeyRef.current = uploadKey
    isUploadingRef.current = true
    lastUploadedUrlRef.current = imageBlobUrl

    let cancelled = false

    // 15s timeout fallback
    const timeout = setTimeout(() => {
      if (!cancelled && phase === 'uploading') {
        setPhase('done')
        message.info('Mạng hơi chậm, bạn có thể tải ảnh local về trước nhé!')
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
        setFinalWithQr(result.stampedBlobUrl)
        lastSessionIdRef.current = result.sessionId
        lastFinalWithQrRef.current = result.stampedBlobUrl
        lastUploadedUrlRef.current = imageBlobUrl
        setPhase('done')
      } catch (err) {
        if (!cancelled) {
          clearTimeout(timeout)
          setErrorMsg(err instanceof Error ? err.message : 'Upload thất bại')
          setPhase('error')
        }
      } finally {
        if (!cancelled) {
          isUploadingRef.current = false
        }
      }
    }

    run()
    return () => { 
      cancelled = true
      clearTimeout(timeout)
    }
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
      {phase === 'done' && (finalWithQr || imageBlobUrl) && (
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          {/* Left — photo preview */}
          <div className="w-full max-w-xs md:max-w-none md:w-[280px] shrink-0 flex flex-col gap-4">
            <div className="w-full flex justify-center">
              <img
                src={finalWithQr || imageBlobUrl!}
                alt="Final photo"
                className="w-full max-h-[60vh] md:max-h-[520px] object-contain rounded-lg border border-[#2a2a2a]"
              />
            </div>
            
            {/* Primary Action buttons */}
            <div className="w-full flex flex-col gap-2">
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

          {/* Right — QR + actions */}
          <div className="flex-1 w-full flex flex-col items-center gap-4">
            {sessionId ? (
              <>
                <p className="text-[#666] text-[10px] uppercase tracking-widest self-start">Quét để xem &amp; chia sẻ</p>
                <div className="p-2 rounded-2xl">
                  <QRCode value={`${window.location.origin}/session/${sessionId}`} size={150} bordered={false} errorLevel="H" icon="/clublogo.png" iconSize={34} />
                </div>
                {/* URL link row */}
                <div className="w-full flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1.5 pl-3">
                  <span className="flex-1 text-[#888] text-[11px] truncate select-all">
                    {`${window.location.origin}/session/${sessionId}`}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`${window.location.origin}/session/${sessionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-[#222] border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] hover:bg-[#2a2a2a] text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5"
                      title="Mở link sang tab mới"
                    >
                      Mở ↗
                    </a>
                    <button
                      onClick={handleCopyUrl}
                      className="px-2.5 py-1 rounded bg-[#222] border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] hover:bg-[#2a2a2a] text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Copy link"
                    >
                      {copied ? <CheckOutlined className="text-green-400" /> : <CopyOutlined />} Copy
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center gap-3">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                <p className="text-[#555] text-xs">Đang cố gắng tạo mã QR...<br/>Bạn có thể tải ảnh local về trước.</p>
              </div>
            )}

            {/* Video recap */}
            {(recapStripUrl || buildingStrip || hasClips) && (
              <div className="w-full flex flex-col gap-3 mt-1">
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
                        <div className="flex items-center justify-center gap-2 mt-0.5">
                          <a href={recapStripUrl} download={`somedia-strip-${Date.now()}.${recapExt}`}
                            className="px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] hover:bg-[#222] text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5">
                            <DownloadOutlined /> Tải về
                          </a>
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
                  <div className="flex flex-col gap-1.5 mt-2">
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
                      <div className="flex gap-1.5 justify-center my-1.5">
                        {recapClips!.map((_, i) => (
                          <button key={i} onClick={() => setCurrentClipIdx(i)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i === currentClipIdx ? 'bg-white' : 'bg-[#444] hover:bg-[#666]'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <a href={recapClips![currentClipIdx]} download={`somedia-clip-${currentClipIdx + 1}-${Date.now()}.${recapExt}`}
                        className="px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] hover:bg-[#222] text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5">
                        <DownloadOutlined /> Tải về
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
