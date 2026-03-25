import { useEffect, useRef, forwardRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useFaceTracking } from '@/hooks/useFaceTracking'
import { getModelById } from '@/lib/modelRegistry'
import type { AR3DFilterType } from '@/types/photobooth'

interface AR3DOverlayProps {
  videoElement: HTMLVideoElement | null
  activeFilter: AR3DFilterType | null
  isEnabled: boolean
  isMirrored?: boolean
}

const AR3DOverlay = forwardRef<HTMLDivElement, AR3DOverlayProps>(({
  videoElement,
  activeFilter,
  isEnabled,
  isMirrored = false,
}, ref) => {
  const internalContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = (ref as React.MutableRefObject<HTMLDivElement | null>) || internalContainerRef
  
  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const currentModelRef = useRef<THREE.Group | null>(null)
  const faceMeshRef = useRef<THREE.Mesh | null>(null)
  const faceGeometryRef = useRef<THREE.BufferGeometry | null>(null)
  
  // MediaPipe Face Tracking
  const { faceData, isReady: trackerReady, startDetection, stopDetection } = useFaceTracking()

  // 1. Initialize Three.js once
  useEffect(() => {
    if (!containerRef.current) return

    const width = containerRef.current.clientWidth || 640
    const height = containerRef.current.clientHeight || 480

    const scene = new THREE.Scene()
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4)
    dirLight.position.set(0, 10, 10)
    scene.add(dirLight)

    // --- Dynamic Face Mesh Occluder Setup ---
    const faceGeometry = new THREE.BufferGeometry()
    const indices = [
      127, 34, 139, 11, 0, 37, 232, 231, 120, 72, 37, 39, 102, 129, 142, 440, 449, 450, 280, 411, 427,
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127
    ]
    faceGeometry.setIndex(indices)
    
    // For 468 landmarks
    const positions = new Float32Array(468 * 3)
    faceGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    const faceMaterial = new THREE.MeshBasicMaterial({ 
      colorWrite: false, // Invisible
      depthWrite: true,   // But fills depth buffer
      side: THREE.DoubleSide 
    })
    
    const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial)
    scene.add(faceMesh)
    faceMeshRef.current = faceMesh
    faceGeometryRef.current = faceGeometry

    // Camera matching standard webcam FOV
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.z = 5

    // Transparent renderer so we can overlay on video
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    
    // Add canvas to DOM
    containerRef.current.appendChild(renderer.domElement)

    // Handle resize
    const overlayCanvas = renderer.domElement
    overlayCanvas.className = 'absolute inset-0 w-full h-full object-cover pointer-events-none'

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer

    return () => {
      renderer.dispose()
      if (containerRef.current && overlayCanvas.parentNode === containerRef.current) {
        containerRef.current.removeChild(overlayCanvas)
      }
    }
  }, [])

  // 2. Load 3D Model when activeFilter changes
  useEffect(() => {
    if (!sceneRef.current || !activeFilter) {
      if (currentModelRef.current && sceneRef.current) {
        sceneRef.current.remove(currentModelRef.current)
        currentModelRef.current = null
      }
      return
    }

    const asset = getModelById(activeFilter)
    if (!asset) return

    // Clean up old model
    if (currentModelRef.current) {
      sceneRef.current.remove(currentModelRef.current)
    }

    const loader = new GLTFLoader()
    loader.load(
      `/models/${asset.path}`,
      (gltf) => {
        const group = new THREE.Group()
        
        // Setup intrinsic scale and offset from registry
        gltf.scene.scale.setScalar(asset.scale)
        gltf.scene.position.set(asset.positionOffset.x, asset.positionOffset.y, asset.positionOffset.z)
        gltf.scene.rotation.set(asset.rotationOffset.x, asset.rotationOffset.y, asset.rotationOffset.z)
        group.add(gltf.scene)

        group.visible = false
        sceneRef.current?.add(group)
        currentModelRef.current = group
      },
      undefined,
      (err) => console.error('Error loading model:', err)
    )
  }, [activeFilter])

  // 3. Start tracking when video and model are ready
  useEffect(() => {
    if (isEnabled && videoElement && trackerReady) {
      startDetection(videoElement)
    } else {
      stopDetection()
      if (currentModelRef.current) {
        currentModelRef.current.visible = false
      }
    }
  }, [isEnabled, videoElement, trackerReady, startDetection, stopDetection])

  // 4. Render loop - update model based on faceData
  useEffect(() => {
    let animationFrameId: number

    const render = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        
        // Update model transform if we have face data
        if (faceData && faceData.faceLandmarks && faceData.faceLandmarks.length > 0) {
          const landmarks = faceData.faceLandmarks[0]
          
          // 1. Update Face Occluder Mesh Geometry (Dynamic deformation)
          if (faceGeometryRef.current && cameraRef.current) {
            const geom = faceGeometryRef.current
            const posAttr = geom.getAttribute('position') as THREE.BufferAttribute
            
            const aspect = cameraRef.current.aspect
            const fovRad = (cameraRef.current.fov * Math.PI) / 180
            const visibleHeight = 2 * Math.tan(fovRad / 2) * cameraRef.current.position.z
            const visibleWidth = visibleHeight * aspect

            for (let i = 0; i < landmarks.length; i++) {
              const lm = landmarks[i]
              const x = isMirrored ? (0.5 - lm.x) * visibleWidth : (lm.x - 0.5) * visibleWidth
              const y = -(lm.y - 0.5) * visibleHeight
              const z = -lm.z * 10 
              posAttr.setXYZ(i, x, y, z)
            }
            posAttr.needsUpdate = true
          }

          // 2. Update 3D Model using Transformation Matrix (Stable positioning)
          if (currentModelRef.current && faceData.facialTransformationMatrixes && faceData.facialTransformationMatrixes.length > 0) {
            const group = currentModelRef.current
            group.visible = true

            // Get the 4x4 matrix from MediaPipe
            const matData = faceData.facialTransformationMatrixes[0].data
            const matrix = new THREE.Matrix4().fromArray(matData)

            // Matrix in MediaPipe is usually in a different coordinate system (Right-handed, but Y is up and Z is toward camera)
            // We need to decompose it or apply it to the group.
            // A common approach is to decompose and lerp for smoothness.
            const position = new THREE.Vector3()
            const quaternion = new THREE.Quaternion()
            const scale = new THREE.Vector3()
            matrix.decompose(position, quaternion, scale)

            // Adjust position for Three.js scene (MediaPipe units are different)
            // We use a simpler heuristic for now: keep the rotation/scale but manual position offset 
            // OR use the matrix directly with some coordinate adjustment.
            
            // For now, let's keep the rotation from the matrix (it's very stable)
            // but use the landmark-based position as it's easier to map to the 2D plane.
            
            const forehead = landmarks[10]
            const aspect = cameraRef.current.aspect
            const fovRad = (cameraRef.current.fov * Math.PI) / 180
            const vHeight = 2 * Math.tan(fovRad / 2) * cameraRef.current.position.z
            const vWidth = vHeight * aspect

            const tx = isMirrored ? (0.5 - forehead.x) * vWidth : (forehead.x - 0.5) * vWidth
            const ty = -(forehead.y - 0.5) * vHeight
            const tz = -forehead.z * 15 - 0.5

            const smoothing = 0.7
            group.position.lerp(new THREE.Vector3(tx, ty, tz), smoothing)
            group.quaternion.slerp(quaternion, smoothing)

            // Face width for scale
            const leftCheek = landmarks[234]
            const rightCheek = landmarks[454]
            const faceWidth = Math.sqrt(Math.pow(rightCheek.x - leftCheek.x, 2) + Math.pow(rightCheek.y - leftCheek.y, 2))
            const targetScale = faceWidth / 0.25 
            group.scale.setScalar(group.scale.x + (targetScale - group.scale.x) * smoothing)
            
          } else if (currentModelRef.current) {
            currentModelRef.current.visible = false
          }
        } else if (currentModelRef.current) {
          currentModelRef.current.visible = false
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [faceData, isMirrored])

  // Handle window resize dynamically adjusting ThreeJS camera aspect
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        const width = containerRef.current.clientWidth
        const height = containerRef.current.clientHeight
        
        cameraRef.current.aspect = width / height
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(width, height)
      }
    }

    window.addEventListener('resize', handleResize)
    setTimeout(handleResize, 100)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 pointer-events-none z-10" 
    />
  )
})

export default AR3DOverlay
