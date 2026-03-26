import { useState, useRef, useEffect } from 'react'
import { Button, Tooltip, message } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { SlotRect } from '@/types/photobooth'

interface FrameSlotEditorProps {
  imageUrl: string
  slots: SlotRect[]
  onChange: (slots: SlotRect[]) => void
}

export default function FrameSlotEditor({ imageUrl, slots, onChange }: FrameSlotEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  
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

    // Prepare a small canvas to read pixel data for flood fill
    const SCALE = 0.5 // High enough for accuracy, low enough for speed
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

  // Update display size on window resize
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
    
    // Map click coordinates to downsampled canvas coordinates
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

    // Convert back to natural coordinates
    const newRect: SlotRect = {
      x: Math.round(minX / canvasScale),
      y: Math.round(minY / canvasScale),
      w: Math.round((maxX - minX + 1) / canvasScale),
      h: Math.round((maxY - minY + 1) / canvasScale),
    }

    // Avoid duplicates
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
      // Small movement: interpret as click for smart detection
      detectSlotAt(dragStart.x, dragStart.y)
    } else {
      // Large movement: interpret as manual rectangle draw
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

  const scaleToDisplay = displaySize.w / imgSize.w

  // Drag preview rectangle
  const previewStyle = isDragging && dragStart && dragCurrent ? {
    left: Math.min(dragStart.x, dragCurrent.x),
    top: Math.min(dragStart.y, dragCurrent.y),
    width: Math.abs(dragCurrent.x - dragStart.x),
    height: Math.abs(dragCurrent.y - dragStart.y),
  } : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-xs">Trình Chỉnh Sửa Slot</span>
          <span className="bg-[#333] text-[#aaa] text-[10px] px-1.5 py-0.5 rounded uppercase">
            {slots.length} Slots
          </span>
        </div>
        <div className="flex gap-2">
          <Tooltip title="Xóa toàn bộ slot">
            <Button size="small" icon={<ClearOutlined />} onClick={clearAll} danger ghost />
          </Tooltip>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-[#111] rounded-lg overflow-hidden border border-[#2a2a2a] cursor-crosshair group select-none"
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
          className="w-full h-auto block pointer-events-none"
          onLoad={handleImgLoad}
        />
        
        {/* Overlay Slots */}
        {slots.map((slot, i) => (
          <div
            key={i}
            className="absolute border-2 border-red-500 bg-red-500/20 group/slot flex items-center justify-center hover:bg-red-500/40 transition-colors"
            style={{
              left: slot.x * scaleToDisplay,
              top: slot.y * scaleToDisplay,
              width: slot.w * scaleToDisplay,
              height: slot.h * scaleToDisplay,
            }}
            onClick={(e) => {
              e.stopPropagation() 
            }}
          >
            <span className="text-white text-[10px] bg-red-600 px-1 rounded-sm font-bold shadow-sm">
              {i + 1}
            </span>
            <button
              onMouseDown={e => e.stopPropagation()} // Prevent drag when clicking delete
              onClick={(e) => { e.stopPropagation(); removeSlot(i); }}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 hover:scale-110 transition-all shadow-lg"
            >
              ×
            </button>
          </div>
        ))}

        {/* Drag Preview */}
        {previewStyle && (
          <div 
            className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none"
            style={previewStyle}
          />
        )}

        {/* Instructions Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 px-2 text-[10px] text-[#aaa] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center">
          Nhấn để Tự động nhận diện · Kéo để Vẽ thủ công
        </div>
      </div>
      
      <p className="text-[#555] text-[10px] italic">
        Tip: Bạn có thể nhấn vào vùng nền trong suốt hoặc tự tay kéo chuột để vẽ vùng slot.
      </p>
    </div>
  )
}
