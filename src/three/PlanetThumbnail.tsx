import { memo, useEffect, useRef } from 'react'
import type { WorldState } from '../types/world'
import { clamp, noise, sampleTerrain, seaLevelForWater, seedOffset, terrainNoise } from './terrain'
import './planet.css'

interface PlanetThumbnailProps {
  seed: string
  state: WorldState
  size?: number
  className?: string
}

/** A small, deterministic CPU render: galleries never allocate WebGL contexts. */
export const PlanetThumbnail = memo(function PlanetThumbnail({ seed, state, size = 96, className = '' }: PlanetThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { water, temperature, vegetation, lifePotential, pollution, civilization, solar, gravity, humidity, volcanicActivity } = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resolution = Math.min(320, Math.round(size * Math.min(window.devicePixelRatio || 1, 1.5)))
    canvas.width = resolution
    canvas.height = resolution
    const pixels = ctx.createImageData(resolution, resolution)
    const seedVector = seedOffset(seed)
    const threshold = seaLevelForWater(water)
    const iceLine = clamp(0.64 + temperature * 0.008 - Math.max(0, -temperature - 10) * 0.012, -0.2, 1.15)
    const plant = clamp(vegetation / 100 * 1.7) * clamp(lifePotential / 40)
    for (let py = 0; py < resolution; py++) {
      for (let px = 0; px < resolution; px++) {
        const x = (px / resolution - 0.5) * 2.15
        const y = -(py / resolution - 0.5) * 2.15
        const radius = x * x + y * y
        if (radius > 1.07) continue
        const index = (py * resolution + px) * 4
        if (radius > 1) {
          const glow = (1.07 - radius) / 0.07
          pixels.data[index] = 47
          pixels.data[index + 1] = 149
          pixels.data[index + 2] = 177
          pixels.data[index + 3] = 90 * glow * glow * clamp(gravity, 0.3, 1.7)
          continue
        }
        const z = Math.sqrt(1 - radius)
        const sampled = sampleTerrain([x, y, z], seedVector)
        const terrain = sampled.elevation
        const detail = sampled.detail
        const micro = noise(x * 100 + seedVector[0], y * 100 + seedVector[1], z * 100 + seedVector[2])
        const land = terrain > threshold
        const shore = clamp(1 - Math.abs(terrain - threshold) / 0.035)
        const light = Math.max(0, -x * 0.57 + y * 0.44 + z * 0.68)
        const illumination = 0.06 + Math.pow(light, 0.8) * (0.72 + solar * 0.0028)
        const ice = clamp((Math.abs(y) - iceLine) * 20)
        let r = land ? 76 * (1 - plant) + 29 * plant : 4 + shore * 2
        let g = land ? 70 * (1 - plant) + 78 * plant : 24 + shore * 45
        let b = land ? 45 * (1 - plant) + 50 * plant : 43 + shore * 30
        const texture = land ? 0.65 + detail * 0.55 + micro * 0.12 : 1
        r = (r * texture * (1 - ice) + 196 * ice) * illumination
        g = (g * texture * (1 - ice) + 218 * ice) * illumination
        b = (b * texture * (1 - ice) + 221 * ice) * illumination
        const rim = Math.pow(1 - z, 4) * (0.15 + light * 0.8)
        const cloud = Math.max(0, terrainNoise(x * 6 + 30, y * 6 + 20, z * 6 + seedVector[2]) - (0.66 - humidity * 0.0015)) * 3
        r += cloud * 110 * illumination + rim * 30
        g += cloud * 135 * illumination + rim * 120
        b += cloud * 145 * illumination + rim * 150
        if (land && light < 0.12 && micro > 0.9 && civilization > 15) {
          r += civilization * 0.9
          g += civilization * 0.5
        }
        r += pollution * 0.04
        if (land && detail > 0.65 && micro > 0.78) {
          r += volcanicActivity * 1.1
          g += volcanicActivity * 0.16
        }
        pixels.data[index] = clamp(r / 255) ** 0.8 * 255
        pixels.data[index + 1] = clamp(g / 255) ** 0.8 * 255
        pixels.data[index + 2] = clamp(b / 255) ** 0.8 * 255
        pixels.data[index + 3] = Math.min(255, (1 - radius) * resolution * 255)
      }
    }
    ctx.putImageData(pixels, 0, 0)
    }
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      frame = requestAnimationFrame(draw)
      observer.disconnect()
    }, { rootMargin: '120px' })
    observer.observe(canvas)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [seed, size, water, temperature, vegetation, lifePotential, pollution, civilization, solar, gravity, humidity, volcanicActivity])

  return <canvas ref={canvasRef} className={`planet-thumbnail ${className}`} width={size} height={size} style={{ width: size, height: size }} aria-hidden="true" />
})
