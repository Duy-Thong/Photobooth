import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { useBackgroundSegmentation } from '@/hooks/useBackgroundSegmentation'
import { BACKGROUNDS } from '@/types/photobooth'

interface BackgroundViewProps {
  videoElement: HTMLVideoElement | null
  activeBackground: string | null
  isEnabled: boolean
  isMirrored?: boolean
}

const BackgroundView = forwardRef<HTMLCanvasElement, BackgroundViewProps>(({
  videoElement,
  activeBackground,
  isEnabled,
  isMirrored = false
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useImperativeHandle(ref, () => canvasRef.current!)
  const { segmentationResultRef, isReady, processFrame } = useBackgroundSegmentation()
  const animationFrameRef = useRef<number | null>(null)
  const bgImageCache = useRef<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    // If disabled or not ready, clean up and return
    if (!isEnabled || !videoElement || !isReady || !activeBackground || activeBackground === 'none') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      if (videoElement.readyState >= 2) {
        // Match canvas size to video
        if (canvas.width !== videoElement.videoWidth) {
          canvas.width = videoElement.videoWidth
          canvas.height = videoElement.videoHeight
        }

        // 1. Process frame (updates segmentationResultRef.current asynchronously)
        processFrame(videoElement)

        const result = segmentationResultRef.current
        if (result && result.categoryMask) {
          const maskData = result.categoryMask.getAsUint8Array()
          
          // Create/Re-use a temporary canvas for the user mask
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')!
          
          // Draw video first to temp
          tempCtx.drawImage(videoElement, 0, 0)
          const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
          const pixels = imageData.data

          // Apply mask: in some Selfie Segmenter versions, 0 might be person or BG
          // If it was blurring the person before, then category 0 was the PERSON.
          // To keep the person, we must make the OTHER categories transparent.
          for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] !== 0) { // If it's NOT category 0 (the background)
              pixels[i * 4 + 3] = 0 // Make transparent
            }
          }
          tempCtx.putImageData(imageData, 0, 0)

          // 2. Composite output on main canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          // Step A: Draw Background
          if (activeBackground === 'blur') {
            ctx.save()
            ctx.filter = 'blur(12px)' // Standardized blur
            ctx.drawImage(videoElement, 0, 0)
            ctx.restore()
          } else if (activeBackground === 'studio') {
            const centerX = canvas.width / 2
            const centerY = canvas.height / 2
            const radius = Math.max(canvas.width, canvas.height) * 0.8
            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
            grad.addColorStop(0, '#a50000') // Brighter red center
            grad.addColorStop(0.5, '#4a0000') // Dark red middle
            grad.addColorStop(1, '#050000') // Black edges
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          } else if (activeBackground === 'studio-blue') {
            ctx.fillStyle = '#326da8'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          } else {
            const bgConfig = BACKGROUNDS.find(b => b.id === activeBackground)
            if (bgConfig?.url) {
              let img = bgImageCache.current.get(bgConfig.url)
              if (!img) {
                img = new Image()
                img.src = bgConfig.url
                img.crossOrigin = 'anonymous'
                const url = bgConfig.url
                img.onload = () => bgImageCache.current.set(url, img!)
              }
              if (img.complete) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              } else {
                ctx.fillStyle = '#1a1a1a'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
              }
            }
          }

          // Step B: Draw User (Foreground)
          ctx.drawImage(tempCanvas, 0, 0)
        } else {
          // Fallback: just draw video if no mask yet
          ctx.drawImage(videoElement, 0, 0)
        }
      }
      animationFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isEnabled, videoElement, isReady, activeBackground, processFrame])
  // Note: segmentationResultRef is a ref, so it doesn't trigger re-renders or need to be in deps

  if (!isEnabled || activeBackground === 'none') return null

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full object-cover z-0 ${isMirrored ? '[transform:scaleX(-1)]' : ''}`}
    />
  )
})

export default BackgroundView
