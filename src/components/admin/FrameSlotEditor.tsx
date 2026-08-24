import { useState, useRef, useEffect } from 'react'
import { Button, Tooltip, message } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { SlotRect } from '@/types/photobooth'
import { useThemeClass } from '@/stores/themeStore'

interface FrameSlotEditorProps {
  imageUrl: string
  slots: SlotRect[]
  onChange: (slots: SlotRect[]) => void
}

export default function FrameSlotEditor({ imageUrl, slots, onChange }: FrameSlotEditorProps) {
  const tc = useThemeClass()
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null)
  
  // For flood fill detection
  const [canvasData, setCanvasData] = useState<ImageData | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)

  // For manual drag-to-draw
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number, y: number } | null>(null)

  const handleImgLoad = () => {
    if (!imgRef.current) return
    const { naturalWidth: nW, naturalHeight: nH, width: dW, height: dH } = imgRef.current
    setImgSize({ w: nW, h: nH })
    setDisplaySize({ w: dW, h: dH })

    // Prepare a canvas to read pixel data for flood fill
    const SCALE = 0.5
    const sw = Math.round(nW * SCALE)
    const sh = Math.round(nH * SCALE)
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(imgRef.current, 0, 0, sw, sh)
      setCanvasData(ctx.getImageData(0, 0, sw, sh))
      setCanvasScale(SCALE)
    }
  }

  // Update display size on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (imgRef.current) {
        setDisplaySize({ w: imgRef.current.width, h: imgRef.current.height })
      }
    })
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [])

  const detectSlotAt = (clickX: number, clickY: number) => {
    if (!canvasData || !imgSize.w) return
    
    const scaleToNatural = imgSize.w / displaySize.w
    const naturalX = clickX * scaleToNatural
    const naturalY = clickY * scaleToNatural
    
    const sw = canvasData.width
    const sh = canvasData.height
    const sx = Math.round(naturalX * canvasScale)
    const sy = Math.round(naturalY * canvasScale)

    if (sx < 0 || sx >= sw || sy < 0 || sy >= sh) return

    const { data } = canvasData
    const ALPHA_THRESH = 20
    
    // Check if clicked pixel is transparent
    const startIdx = (sy * sw + sx) * 4
    if (data[startIdx + 3] > ALPHA_THRESH) {
      message.warning('Vui lòng nhấn vào vùng nền TRONG SUỐT để tự động nhận diện slot.')
      return
    }

    // Flood fill (BFS/DFS) to find bounding box
    const visited = new Uint8Array(sw * sh)
    const stack = [[sx, sy]]
    visited[sy * sw + sx] = 1
    
    let minX = sx, maxX = sx, minY = sy, maxY = sy

    while (stack.length) {
      const [px, py] = stack.pop()!
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py

      const neighbors = [
        [px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]
      ]

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
          const nIdx = ny * sw + nx
          if (!visited[nIdx] && data[nIdx * 4 + 3] < ALPHA_THRESH) {
            visited[nIdx] = 1
            stack.push([nx, ny])
          }
        }
      }
    }

    const rawX = Math.round(minX / canvasScale)
    const rawY = Math.round(minY / canvasScale)
    const rawW = Math.round((maxX - minX + 1) / canvasScale)
    const rawH = Math.round((maxY - minY + 1) / canvasScale)

    // Add padding (bleed outward)
    const pad = Math.max(6, Math.round(Math.min(rawW, rawH) * 0.015))
    const finalX = Math.max(0, rawX - pad)
    const finalY = Math.max(0, rawY - pad)
    const maxW = (imgSize.w || finalX + rawW) - finalX
    const maxH = (imgSize.h || finalY + rawH) - finalY
    const finalW = Math.min(maxW, rawW + (rawX - finalX) + pad)
    const finalH = Math.min(maxH, rawH + (rawY - finalY) + pad)

    const newRect: SlotRect = {
      x: finalX,
      y: finalY,
      w: finalW,
      h: finalH,
    }

    addSlot(newRect)
  }

  const addSlot = (rect: SlotRect) => {
    if (rect.w < 5 || rect.h < 5) return

    const alreadyExists = slots.some(s => 
      Math.abs(s.x - rect.x) < 5 && 
      Math.abs(s.y - rect.y) < 5 && 
      Math.abs(s.w - rect.w) < 5
    )
    
    if (alreadyExists) {
      message.info('Vùng này đã được thêm rồi.')
      return
    }

    const nextSlots = [...slots, rect].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
    onChange(nextSlots)
    message.success(`Đã thêm 1 slot mới (${nextSlots.length} slot)`)
  }

  const removeSlot = (index: number) => {
    const next = slots.filter((_, i) => i !== index)
    onChange(next)
  }

  const clearAll = () => {
    onChange([])
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setIsDragging(true)
    setDragStart({ x, y })
    setDragCurrent({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDragCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) return
    
    const dx = Math.abs(dragCurrent.x - dragStart.x)
    const dy = Math.abs(dragCurrent.y - dragStart.y)

    if (dx < 5 && dy < 5) {
      detectSlotAt(dragStart.x, dragStart.y)
    } else {
      const scaleToNatural = imgSize.w / displaySize.w
      const x = Math.min(dragStart.x, dragCurrent.x) * scaleToNatural
      const y = Math.min(dragStart.y, dragCurrent.y) * scaleToNatural
      const w = Math.abs(dragStart.x - dragCurrent.x) * scaleToNatural
      const h = Math.abs(dragCurrent.y - dragStart.y) * scaleToNatural
      
      addSlot({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
      })
    }

    setIsDragging(false)
    setDragStart(null)
    setDragCurrent(null)
  }

  const scaleToDisplay = displaySize.w / (imgSize.w || 1)

  const curW = isDragging && dragStart && dragCurrent && displaySize.w > 0
    ? Math.round(Math.abs(dragCurrent.x - dragStart.x) * (imgSize.w / displaySize.w))
    : 0
  const curH = isDragging && dragStart && dragCurrent && displaySize.w > 0
    ? Math.round(Math.abs(dragCurrent.y - dragStart.y) * (imgSize.w / displaySize.w))
    : 0

  // Drag preview rectangle
  const previewStyle = isDragging && dragStart && dragCurrent ? {
    left: Math.min(dragStart.x, dragCurrent.x),
    top: Math.min(dragStart.y, dragCurrent.y),
    width: Math.abs(dragCurrent.x - dragStart.x),
    height: Math.abs(dragCurrent.y - dragStart.y),
  } : null

  const isVertical = imgSize.h > imgSize.w * 1.3
  const frameWidth = isVertical ? '440px' : '540px'

  return (
    <div className="flex flex-col h-full overflow-hidden gap-2.5">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between shrink-0 pb-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xs ${tc('text-white', 'text-slate-800')}`}>Trình Chỉnh Sửa Slot</span>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${tc('bg-blue-950/80 text-blue-400 border border-blue-800/60', 'bg-blue-50 text-blue-600 border border-blue-200')}`}>
            {slots.length} Slots
          </span>
        </div>

        <Tooltip title="Xóa toàn bộ slot">
          <Button size="small" icon={<ClearOutlined />} onClick={clearAll} danger ghost>
            Xóa tất cả slot
          </Button>
        </Tooltip>
      </div>

      {/* Scrollable Canvas Workspace */}
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-xl border p-4 flex justify-center items-start ${tc('bg-[#080808] border-[#222]', 'bg-slate-100/90 border-slate-200')}`}>
        <div 
          ref={containerRef}
          className={`relative rounded-lg overflow-hidden border cursor-crosshair group select-none shadow-lg my-auto ${tc('bg-[#141414] border-[#2a2a2a]', 'bg-white border-slate-300')}`}
          style={{ width: frameWidth, maxWidth: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDragging) handleMouseUp()
          }}
        >
          <img 
            ref={imgRef}
            src={imageUrl} 
            alt="Frame editor" 
            className="w-full h-auto block pointer-events-none select-none"
            onLoad={handleImgLoad}
          />
          
          {/* Overlay Slots */}
          {slots.map((slot, i) => (
            <div
              key={i}
              className={`absolute border-2 border-red-500 bg-red-500/20 group/slot flex items-center justify-center transition-colors ${
                hoveredSlot === i ? 'bg-red-500/40 border-red-400 ring-2 ring-red-400/50' : 'hover:bg-red-500/35'
              }`}
              style={{
                left: slot.x * scaleToDisplay,
                top: slot.y * scaleToDisplay,
                width: slot.w * scaleToDisplay,
                height: slot.h * scaleToDisplay,
              }}
              onMouseEnter={() => setHoveredSlot(i)}
              onMouseLeave={() => setHoveredSlot(null)}
              onClick={(e) => {
                e.stopPropagation() 
              }}
            >
              <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                <span className="text-white text-[11px] bg-red-600 px-1.5 py-0.5 rounded font-bold shadow-md">
                  Slot {i + 1}
                </span>
                <span className="text-[9px] text-white/90 bg-black/60 px-1 rounded font-mono">
                  {Math.round(slot.w)} × {Math.round(slot.h)}
                </span>
              </div>
              
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); removeSlot(i); }}
                className="absolute -top-2.5 -right-2.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs opacity-0 group-hover/slot:opacity-100 hover:scale-110 transition-all shadow-lg cursor-pointer border border-white"
              >
                ×
              </button>
            </div>
          ))}

          {/* Drag Preview */}
          {previewStyle && (
            <div 
              className="absolute border-2 border-dashed border-blue-400 bg-blue-500/25 pointer-events-none flex items-center justify-center"
              style={previewStyle}
            >
              {curW > 0 && curH > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  {curW} × {curH} px
                </span>
              )}
            </div>
          )}

          {/* Instructions Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-xs py-1.5 px-3 text-[11px] text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center">
            🖱️ Nhấp vào vùng trong suốt để nhận diện · Kéo chuột để vẽ thủ công
          </div>
        </div>
      </div>
      
      {/* Bottom Hint */}
      <div className={`flex items-center justify-between text-[11px] shrink-0 ${tc('text-slate-400', 'text-slate-500')}`}>
        <span>💡 Nhấp vào ô trong suốt để tự nhận diện hoặc kéo chuột vẽ vùng slot mong muốn.</span>
        {imgSize.w > 0 && (
          <span className="font-mono text-[10px] opacity-75">Kích thước gốc: {imgSize.w} × {imgSize.h}px</span>
        )}
      </div>
    </div>
  )
}
