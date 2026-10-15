import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import type { Quality, WorldState } from '../types/world'
import { PlanetThumbnail } from './PlanetThumbnail'
import { atmosphereFragment, cloudFragment, sphereVertex, surfaceFragment } from './shaders'
import { clamp, regionDescription, seedOffset } from './terrain'
import './planet.css'

interface PlanetProps {
  seed: string
  state: WorldState
  quality?: Quality
  interactive?: boolean
  className?: string
  showControls?: boolean
  onRegionSelect?: (description: string) => void
}

interface PlanetControls {
  reset: () => void
  zoom: (delta: number) => void
  toggle: () => boolean
}

const wantsReducedMotion = () => document.documentElement.dataset.reducedMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Planet({ seed, state, quality = 'auto', interactive = true, className = '', showControls = true, onRegionSelect }: PlanetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  const selectRef = useRef(onRegionSelect)
  const controlsRef = useRef<PlanetControls | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [rotating, setRotating] = useState(() => !wantsReducedMotion())

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { selectRef.current = onRegionSelect }, [onRegionSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: quality !== 'low', powerPreference: 'high-performance' })
    } catch {
      const failureFrame = requestAnimationFrame(() => { setFailed(true); setReady(false) })
      return () => cancelAnimationFrame(failureFrame)
    }
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    renderer.domElement.className = 'planet-canvas'
    if (interactive) {
      renderer.domElement.tabIndex = 0
      renderer.domElement.setAttribute('role', 'img')
      renderer.domElement.setAttribute('aria-label', 'Interactive planet. Arrow keys rotate, plus and minus zoom, Space pauses rotation, Home resets the view, Enter inspects the center.')
    } else renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30)
    const defaultDistance = 3.5
    let cameraDistance = defaultDistance
    let targetDistance = defaultDistance
    camera.position.set(0, 0, cameraDistance)
    const group = new THREE.Group()
    scene.add(group)
    const current = stateRef.current
    const uniforms = {
      uSeed: { value: new THREE.Vector3(...seedOffset(seed)) },
      uWater: { value: current.water / 100 },
      uTemperature: { value: current.temperature },
      uVegetation: { value: current.vegetation / 100 },
      uLife: { value: current.lifePotential / 100 },
      uCivilization: { value: current.civilization / 100 },
      uPollution: { value: current.pollution / 100 },
      uVolcanism: { value: current.volcanicActivity / 100 },
      uSolar: { value: current.solar },
      uGravity: { value: current.gravity },
      uHumidity: { value: current.humidity / 100 },
      uTime: { value: 0 },
    }
    const segments = quality === 'low' ? 64 : 96
    const geometry = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75))
    const surfaceMaterial = new THREE.ShaderMaterial({ vertexShader: sphereVertex, fragmentShader: surfaceFragment, uniforms })
    const cloudMaterial = new THREE.ShaderMaterial({ vertexShader: sphereVertex, fragmentShader: cloudFragment, uniforms, transparent: true, depthWrite: false })
    const atmosphereMaterial = new THREE.ShaderMaterial({ vertexShader: sphereVertex, fragmentShader: atmosphereFragment, uniforms, transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const globe = new THREE.Mesh(geometry, surfaceMaterial)
    const clouds = new THREE.Mesh(geometry, cloudMaterial)
    const atmosphere = new THREE.Mesh(geometry, atmosphereMaterial)
    clouds.scale.setScalar(1.012)
    atmosphere.scale.setScalar(1.045)
    clouds.renderOrder = 1
    atmosphere.renderOrder = 2
    group.add(globe, clouds, atmosphere)

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = wantsReducedMotion()
    let autoRotate = !reducedMotion
    let pointerIsDown = false
    let rotationX = 0.08
    let rotationY = -0.12
    let visible = true
    let contextLost = false
    let shaderFailed = false
    let frame = 0
    let lastTime = 0
    let hasRendered = false
    let needsRender = true
    let lastRenderedState: WorldState | null = null
    let elapsed = 0
    let pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : quality === 'low' ? 1 : 1.35)
    let slowFrames = 0
    let sampledFrames = 0
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      shaderFailed = true
      cancelAnimationFrame(frame)
      frame = 0
      setReady(false)
      setFailed(true)
      console.error('Planet shader compilation failed.', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment))
    }

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height)
      needsRender = true
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    const pointers = new Map<number, { x: number; y: number }>()
    let press = { x: 0, y: 0 }
    let moved = false
    let pinchDistance = 0
    const pointerDistance = () => {
      const points = [...pointers.values()]
      return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0
    }
    const canvas = renderer.domElement
    const onPointerDown = (event: PointerEvent) => {
      if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return
      canvas.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      pointerIsDown = true
      press = { x: event.clientX, y: event.clientY }
      moved = pointers.size > 1
      pinchDistance = pointerDistance()
      container.classList.add('is-dragging')
    }
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous) return
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) moved = true
      if (pointers.size === 2) {
        const distance = pointerDistance()
        targetDistance = clamp(targetDistance + (pinchDistance - distance) * 0.008, 2.5, 5.3)
        pinchDistance = distance
      } else {
        rotationY += dx * 0.005
        rotationX = clamp(rotationX + dy * 0.005, -1.2, 1.2)
      }
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.delete(event.pointerId)
      pointerIsDown = pointers.size > 0
      if (!pointerIsDown) container.classList.remove('is-dragging')
      if (!moved && event.type !== 'pointercancel' && selectRef.current) {
        const rect = canvas.getBoundingClientRect()
        const position = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(position, camera)
        const hit = raycaster.intersectObject(globe)[0]
        if (hit) selectRef.current(regionDescription(globe.worldToLocal(hit.point.clone()).toArray(), seed, stateRef.current))
      }
    }
    const onWheel = (event: WheelEvent) => {
      if (!interactive) return
      event.preventDefault()
      targetDistance = clamp(targetDistance + event.deltaY * 0.0015, 2.5, 5.3)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!interactive) return
      const amount = event.shiftKey ? 0.2 : 0.08
      switch (event.key) {
        case 'ArrowLeft': rotationY -= amount; break
        case 'ArrowRight': rotationY += amount; break
        case 'ArrowUp': rotationX = clamp(rotationX - amount, -1.2, 1.2); break
        case 'ArrowDown': rotationX = clamp(rotationX + amount, -1.2, 1.2); break
        case '+': case '=': targetDistance = clamp(targetDistance - 0.25, 2.5, 5.3); break
        case '-': targetDistance = clamp(targetDistance + 0.25, 2.5, 5.3); break
        case 'Home': rotationX = 0.08; rotationY = -0.12; targetDistance = defaultDistance; break
        case ' ': autoRotate = !autoRotate; setRotating(autoRotate); break
        case 'Enter': {
          const center = globe.worldToLocal(new THREE.Vector3(0, 0, 1)).normalize()
          selectRef.current?.(regionDescription(center.toArray(), seed, stateRef.current))
          break
        }
        default: return
      }
      event.preventDefault()
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('lostpointercapture', onPointerUp)
    canvas.addEventListener('keydown', onKeyDown)
    if (interactive) canvas.addEventListener('wheel', onWheel, { passive: false })
    controlsRef.current = {
      reset: () => { rotationX = 0.08; rotationY = -0.12; targetDistance = defaultDistance },
      zoom: (delta) => { targetDistance = clamp(targetDistance + delta, 2.5, 5.3) },
      toggle: () => { autoRotate = !autoRotate; return autoRotate },
    }

    const animate = (time: number) => {
      if (disposed || contextLost || shaderFailed || !visible || document.hidden) { frame = 0; return }
      frame = requestAnimationFrame(animate)
      if (hasRendered && reducedMotion && !autoRotate && !pointerIsDown && !needsRender && stateRef.current === lastRenderedState && group.rotation.x === rotationX && group.rotation.y === rotationY && cameraDistance === targetDistance) return
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.08) : 0.016
      lastTime = time
      elapsed += dt
      if (autoRotate && !pointerIsDown) rotationY += dt * 0.028
      const easing = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6)
      group.rotation.x += (rotationX - group.rotation.x) * easing
      group.rotation.y += (rotationY - group.rotation.y) * easing
      if (!reducedMotion) clouds.rotation.y += dt * 0.009
      cameraDistance += (targetDistance - cameraDistance) * easing
      camera.position.z = cameraDistance / Math.min(camera.aspect, 1)
      const next = stateRef.current
      const lerp = (name: keyof typeof uniforms, target: number) => {
        const uniform = uniforms[name]
        if (typeof uniform.value === 'number') uniform.value += (target - uniform.value) * easing
      }
      lerp('uWater', next.water / 100)
      lerp('uTemperature', next.temperature)
      lerp('uVegetation', next.vegetation / 100)
      lerp('uLife', next.lifePotential / 100)
      lerp('uCivilization', next.civilization / 100)
      lerp('uPollution', next.pollution / 100)
      lerp('uVolcanism', next.volcanicActivity / 100)
      lerp('uSolar', next.solar)
      lerp('uGravity', next.gravity)
      lerp('uHumidity', next.humidity / 100)
      atmosphere.scale.setScalar(1.028 + clamp(uniforms.uGravity.value, 0.3, 2) * 0.018)
      uniforms.uTime.value = reducedMotion ? 0 : elapsed
      renderer.render(scene, camera)
      if (shaderFailed) return
      needsRender = false
      lastRenderedState = stateRef.current
      if (!hasRendered) {
        hasRendered = true
        setReady(true)
        setFailed(false)
        setRotating(autoRotate)
      }
      // Auto quality reduces fill-rate only after a sustained slow sample.
      if (quality === 'auto' && sampledFrames < 100 && elapsed > 1.5) {
        sampledFrames++
        if (dt > 0.032) slowFrames++
        if (sampledFrames === 100 && slowFrames > 65 && pixelRatio > 0.85) {
          pixelRatio = Math.max(0.85, pixelRatio * 0.78)
          sampledFrames = 0
          slowFrames = 0
          resize()
        }
      }
    }
    const resume = () => {
      if (!frame && !disposed && visible && !document.hidden && !contextLost && !shaderFailed) {
        lastTime = 0
        frame = requestAnimationFrame(animate)
      }
    }
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
      else resume()
    }
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (!visible) { cancelAnimationFrame(frame); frame = 0 }
      else resume()
    }, { rootMargin: '80px' })
    intersectionObserver.observe(container)
    const onMotionChange = () => {
      reducedMotion = wantsReducedMotion()
      autoRotate = !reducedMotion
      needsRender = true
      setRotating(autoRotate)
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(frame)
      frame = 0
      setReady(false)
      setFailed(true)
    }
    const onContextRestored = () => {
      contextLost = false
      shaderFailed = false
      hasRendered = false
      resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    motionQuery.addEventListener('change', onMotionChange)
    window.addEventListener('microverse:motion', onMotionChange)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    resume()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery.removeEventListener('change', onMotionChange)
      window.removeEventListener('microverse:motion', onMotionChange)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('lostpointercapture', onPointerUp)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      geometry.dispose()
      surfaceMaterial.dispose()
      cloudMaterial.dispose()
      atmosphereMaterial.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      controlsRef.current = null
    }
  }, [seed, quality, interactive])

  return <div ref={containerRef} className={`planet-renderer ${interactive ? 'is-interactive' : ''} ${ready ? 'is-ready' : ''} ${className}`} role={interactive ? 'group' : 'img'} aria-label="Procedurally generated living planet">
    {!ready && <div className="planet-fallback"><PlanetThumbnail seed={seed} state={state} size={320} /></div>}
    {failed && <span className="planet-fallback-note">Illustrated view · Your world keeps evolving</span>}
    {interactive && showControls && ready && <div className="planet-controls" aria-label="Planet view controls">
      <button type="button" title={rotating ? 'Pause rotation' : 'Resume rotation'} aria-label={rotating ? 'Pause planet rotation' : 'Resume planet rotation'} aria-pressed={!rotating} onClick={() => setRotating(controlsRef.current?.toggle() ?? false)}>{rotating ? <Pause size={14} /> : <Play size={14} />}</button>
      <span className="planet-control-divider" />
      <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => controlsRef.current?.zoom(0.35)}><Minus size={16} /></button>
      <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => controlsRef.current?.zoom(-0.35)}><Plus size={16} /></button>
      <span className="planet-control-divider" />
      <button type="button" title="Reset view" aria-label="Reset planet view" onClick={() => controlsRef.current?.reset()}><RotateCcw size={14} /></button>
    </div>}
  </div>
}
