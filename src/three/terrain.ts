import type { WorldState } from '../types/world'

export function seedOffset(seed: string): [number, number, number] {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return [((hash >>> 0) % 997) / 19, ((hash >>> 8) % 991) / 21, ((hash >>> 16) % 983) / 23]
}

const mix = (a: number, b: number, n: number) => a + (b - a) * n
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))

function hash(x: number, y: number, z: number): number {
  // Integer operations match the WebGL2 hash; sine hashes differ between CPU/GPU.
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  let fx = x - ix, fy = y - iy, fz = z - iz
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  fz = fz * fz * (3 - 2 * fz)
  return mix(mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy), mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy), fz)
}

export function terrainNoise(x: number, y: number, z: number): number {
  let result = 0, amplitude = 0.5
  for (let i = 0; i < 5; i++) {
    result += noise(x, y, z) * amplitude
    x = x * 2.03 + 13.7
    y = y * 2.03 + 9.2
    z = z * 2.03 + 17.4
    amplitude *= 0.5
  }
  return result
}

export function seaLevelForWater(water: number): number {
  const fraction = clamp(water / 100, 0.0001, 0.9999)
  return 0.485 + 0.066 * Math.log(fraction / (1 - fraction))
}

export function sampleTerrain(point: readonly [number, number, number], offset: readonly [number, number, number]) {
  const [x, y, z] = point
  const continental = terrainNoise(x * 2.65 + offset[0], y * 2.65 + offset[1], z * 2.65 + offset[2])
  const detail = terrainNoise(x * 24 + offset[0], y * 24 + offset[1], z * 24 + offset[2])
  return { elevation: continental + (detail - 0.5) * 0.075, detail }
}

export function regionDescription(point: readonly [number, number, number], seed: string, state: WorldState): string {
  const iceLine = clamp(0.64 + state.temperature * 0.008 - Math.max(0, -state.temperature - 10) * 0.012, -0.2, 1.15)
  if (Math.abs(point[1]) > iceLine) return 'Polar reaches · Ancient ice shapes the edge of this world.'
  const terrain = sampleTerrain(point, seedOffset(seed))
  if (terrain.elevation < seaLevelForWater(state.water)) return 'Open ocean · Deep currents carry the building blocks of life.'
  if (state.temperature > 40) return 'Sun-scorched terrain · Water and shade are precious here.'
  if (state.temperature < -5) return 'Frozen frontier · Life waits beneath the ice.'
  if (state.vegetation > 45) return 'Living continent · Forests exchange moisture with the atmosphere.'
  if (state.volcanicActivity > 45) return 'Volcanic highlands · New minerals rise from the planet’s interior.'
  return 'Young terrain · A landscape still finding its balance.'
}
