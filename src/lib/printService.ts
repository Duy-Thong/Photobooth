import { Modal } from 'antd'

/**
 * Print a single image at 4x6in.
 */
export function printSingleImage(imageUrl: string, onPrinted?: () => void): void {
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
  img.src = imageUrl
  frame.appendChild(img)
  document.head.appendChild(style)
  document.body.appendChild(frame)

  const cleanup = () => {
    style.remove()
    frame.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  const doPrint = () => {
    window.print()
    onPrinted?.()
  }

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

/**
 * Print multiple images, each on its own page (4x6in).
 */
export function printMultipleImages(imageUrls: string[], onPrinted?: () => void): void {
  if (imageUrls.length === 0) return

  const style = document.createElement('style')
  style.innerHTML = `
    @page { size: 4in 6in portrait; margin: 3mm; }
    @media print {
      body > *:not(#__print_frame) { display: none !important; }
      #__print_frame {
        display: block !important;
      }
      .print-page {
        width: 100%;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        page-break-after: always;
        background: white;
      }
      .print-page:last-child { page-break-after: avoid; }
      .print-page img { max-width: 100%; max-height: 100%; object-fit: contain; }
    }
  `
  const frame = document.createElement('div')
  frame.id = '__print_frame'
  frame.style.display = 'none'

  imageUrls.forEach(url => {
    const page = document.createElement('div')
    page.className = 'print-page'
    const img = document.createElement('img')
    img.src = url
    page.appendChild(img)
    frame.appendChild(page)
  })

  document.head.appendChild(style)
  document.body.appendChild(frame)

  const cleanup = () => {
    style.remove()
    frame.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  const doPrint = () => {
    window.print()
    onPrinted?.()
  }

  // Wait for all images to load before printing
  const imgs = Array.from(frame.querySelectorAll('img')) as HTMLImageElement[]
  const pending = imgs.filter(img => !img.complete || img.naturalWidth === 0)
  if (pending.length === 0) {
    doPrint()
  } else {
    let loaded = 0
    pending.forEach(img => {
      const done = () => {
        loaded++
        if (loaded === pending.length) {
          doPrint()
        }
      }
      img.onload = done
      img.onerror = done
    })
  }
}
