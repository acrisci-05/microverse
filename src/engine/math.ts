import type { WorldParameters, WorldState } from '../types/world'

export const PARAMETER_LIMITS = {
  water: [0, 100],
  temperature: [-50, 80],
  solar: [20, 160],
  gravity: [0.3, 2],
  lifePotential: [0, 100],
} as const

export const DEFAULT_PARAMETERS: WorldParameters = {
  water: 64, temperature: 18, solar: 100, gravity: 1, lifePotential: 62,
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function approach(value: number, target: number, maxChange: number): number {
  return value + clamp(target - value, -maxChange, maxChange)
}

export function normalizeParameters(input: WorldParameters): WorldParameters {
  return Object.fromEntries(Object.entries(PARAMETER_LIMITS).map(([key, [min, max]]) => [
    key, clamp(input[key as keyof WorldParameters], min, max),
  ])) as unknown as WorldParameters
}

export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  }
  return hash >>> 0
}

/** Mulberry32: all randomness is represented by a serializable uint32 state. */
export function randomStep(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0
  let word = next
  word = Math.imul(word ^ (word >>> 15), word | 1)
  word ^= word + Math.imul(word ^ (word >>> 7), word | 61)
  return { state: next, value: ((word ^ (word >>> 14)) >>> 0) / 4294967296 }
}

const PERCENT_FIELDS = [
  'humidity', 'vegetation', 'biodiversity', 'animals', 'fertility', 'resources',
  'technology', 'civilization', 'pollution', 'stability', 'energy', 'volcanicActivity',
] as const

export function boundState(state: WorldState): WorldState {
  const next = { ...state, ...normalizeParameters(state) }
  for (const key of PERCENT_FIELDS) next[key] = clamp(next[key])
  next.cycle = Math.floor(clamp(next.cycle, 0, 1_000_000_000))
  next.balancedCycles = Math.floor(clamp(next.balancedCycles, 0, next.cycle))
  next.oceanCycles = Math.floor(clamp(next.oceanCycles, 0, next.cycle))
  next.rngState = next.rngState >>> 0
  return next
}
